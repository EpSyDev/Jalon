"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, RefusMetier, valider, type Resultat } from "@/lib/actions";
import type { Tx } from "@/lib/db";
import { premierMessage } from "@/lib/metier/controles";
import {
  LIBELLES_STATUT_EQUIPEMENT,
  schemaCategorie,
  schemaEquipement,
  schemaInfosEquipement,
  schemaLocalisation,
  schemaModificationGroupee,
  schemaStatut,
  schemaUnivers,
} from "@/lib/metier/parc";
import { categorieParNom, modifierEnMasse } from "@/lib/requetes/parc";

const LIBELLES: Record<string, string> = {
  code: "Code",
  libelle: "Libellé",
  categorie_id: "Catégorie",
  categorie_nouvelle: "Nouvelle catégorie",
  localisation_id: "Localisation",
  univers_id: "Univers",
  description: "Description",
  marque: "Marque",
  modele: "Modèle",
  numero_serie: "N° de série",
  date_mise_en_service: "Mise en service",
  statut: "Statut",
  statut_depuis: "Depuis le",
  statut_motif: "Motif",
  statut_prestataire_id: "Prestataire",
  statut_retour_prevu: "Retour prévu",
  notes: "Notes",
  batiment: "Bâtiment",
  niveau: "Niveau",
  local: "Local",
};

const CODE_EN_DOUBLE = (echec: string) =>
  echec.replace("Cet élément existe déjà.", "Ce code d'équipement existe déjà.");

function rafraichir() {
  revalidatePath("/", "layout");
}

/** Catégorie saisie à la volée : retrouvée ou créée dans l'univers de l'équipement. */
async function avecCategorie<T extends { categorie_id: string | null; categorie_nouvelle: string | null }>(
  tx: Tx,
  donnees: T & { univers_id: string | null },
) {
  const { categorie_nouvelle, ...reste } = donnees;
  return categorie_nouvelle
    ? { ...reste, categorie_id: await categorieParNom(tx, categorie_nouvelle, donnees.univers_id) }
    : reste;
}

export async function creerEquipement(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaEquipement, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.equipements ${tx(await avecCategorie(tx, donnees))}
      returning id`;
  });
  if (echec) return { erreur: CODE_EN_DOUBLE(echec) };
  rafraichir();
  redirect(`/equipements/${id}`);
}

/** Informations modifiées depuis la fiche (le statut a son propre formulaire). */
export async function modifierEquipement(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaInfosEquipement, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer(async (tx) => {
    await tx`update public.equipements set ${tx(await avecCategorie(tx, donnees))} where id = ${id}`;
  });
  if (echec) return { erreur: CODE_EN_DOUBLE(echec) };
  rafraichir();
  return { message: "Informations enregistrées." };
}

/** Statut changé depuis la fiche ; une réparation peut ouvrir l'intervention qui la suivra. */
export async function changerStatutEquipement(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaStatut, formData, LIBELLES);
  if (!ok) return { erreur };
  const { creer_intervention, ...statut } = donnees;
  let ouvertes = 0;
  const echec = await executer(async (tx) => {
    const [e] = await tx<{ libelle: string }[]>`
      update public.equipements set ${tx(statut)} where id = ${id} and archive_le is null returning libelle`;
    if (!e) throw new RefusMetier("Équipement introuvable : rechargez la page.");
    if (creer_intervention) {
      const nature = statut.statut === "reparation_externe" ? "externe" : "interne";
      await tx`insert into public.interventions ${tx({
        type: "corrective",
        titre: `Réparation ${nature} : ${statut.statut_motif ?? e.libelle}`.slice(0, 200),
        equipement_id: id,
        prestataire_id: statut.statut_prestataire_id,
        statut: "en_cours",
        date_prevue: statut.statut_retour_prevu,
      })}`;
    }
    if (statut.statut === "en_service") {
      [{ n: ouvertes }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.interventions
        where equipement_id = ${id} and archive_le is null and statut not in ('terminee', 'annulee')`;
    }
  });
  if (echec) return { erreur: echec };
  rafraichir();
  const libelle = LIBELLES_STATUT_EQUIPEMENT[statut.statut].toLowerCase();
  return {
    message: [
      `Statut enregistré : ${libelle}.`,
      creer_intervention && "Intervention de suivi ouverte.",
      ouvertes > 0 &&
        `${ouvertes} intervention${ouvertes > 1 ? "s restent ouvertes" : " reste ouverte"} : pensez à la clôturer.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function archiverEquipement(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.plans_controle where equipement_id = ${id} and archive_le is null`;
    if (n > 0) throw new RefusMetier(`${n} plan(s) de contrôle portent sur cet équipement : archivez-les d'abord.`);
    await tx`update public.equipements set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/equipements");
}

export async function creerLocalisation(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaLocalisation, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer(async (tx) => {
    const [doublon] = await tx`
      select 1 from public.localisations
      where archive_le is null and public.normaliser(batiment) = public.normaliser(${donnees.batiment})
        and public.normaliser(niveau) = public.normaliser(${donnees.niveau})
        and public.normaliser(local) = public.normaliser(${donnees.local})`;
    if (doublon) throw new RefusMetier("Cette localisation existe déjà.");
    await tx`insert into public.localisations ${tx(donnees)}`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Localisation ajoutée." };
}

export async function archiverLocalisation(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.equipements where localisation_id = ${id} and archive_le is null`;
    if (n > 0) throw new RefusMetier(`${n} équipement(s) sont rattachés à cette localisation.`);
    await tx`update public.localisations set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Localisation archivée." };
}

// --- Univers et catégories ----------------------------------------------------------------

export async function creerUnivers(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaUnivers, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.univers ${tx(donnees)}`);
  if (echec) return { erreur: echec.replace("Cet élément existe déjà.", "Un univers porte déjà ce nom.") };
  rafraichir();
  return { message: "Univers créé : ajoutez-y des catégories et des équipements." };
}

export async function archiverUnivers(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n, c }] = await tx<{ n: number; c: number }[]>`
      select (select count(*)::int from public.equipements where univers_id = ${id} and archive_le is null) as n,
        (select count(*)::int from public.categories_equipement where univers_id = ${id} and archive_le is null) as c`;
    if (n > 0) throw new RefusMetier(`${n} équipement(s) sont rattachés à cet univers : déplacez-les d'abord.`);
    if (c > 0) throw new RefusMetier(`${c} catégorie(s) appartiennent à cet univers : archivez-les d'abord.`);
    await tx`update public.univers set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Univers archivé." };
}

export async function creerCategorie(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaCategorie, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.categories_equipement ${tx(donnees)}`);
  if (echec)
    return { erreur: echec.replace("Cet élément existe déjà.", "Cette catégorie existe déjà dans cet univers.") };
  rafraichir();
  return { message: "Catégorie créée." };
}

/** Range des catégories dans un univers : leurs équipements suivent (trigger en base). */
export async function rangerCategories(formData: FormData): Promise<Resultat> {
  const ids = [...new Set(formData.getAll("ids").filter((v): v is string => typeof v === "string"))];
  const universId = formData.get("univers_id");
  if (ids.length === 0) return { erreur: "Cochez au moins une catégorie." };
  if (ids.length > 200 || !idsValides(...ids)) return ID_INVALIDE;
  if (typeof universId !== "string" || !idsValides(universId)) return { erreur: "Univers : choisissez un univers." };
  let n = 0;
  const echec = await executer(async (tx) => {
    [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.equipements where categorie_id = any(${ids}::uuid[]) and archive_le is null`;
    await tx`update public.categories_equipement set univers_id = ${universId}
      where id = any(${ids}::uuid[]) and archive_le is null`;
  });
  if (echec)
    return {
      erreur: echec.replace("Cet élément existe déjà.", "Cet univers a déjà une catégorie portant l'un de ces noms."),
    };
  rafraichir();
  const c = ids.length;
  return {
    message: `${c} catégorie${c > 1 ? "s rangées" : " rangée"}${n ? ` avec ${n} équipement${n > 1 ? "s" : ""}` : ""}.`,
  };
}

export async function archiverCategorie(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.equipements where categorie_id = ${id} and archive_le is null`;
    if (n > 0) throw new RefusMetier(`${n} équipement(s) sont dans cette catégorie : changez-les d'abord.`);
    await tx`update public.categories_equipement set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Catégorie archivée." };
}

// --- Modification groupée ------------------------------------------------------------

/** Change l'univers, la catégorie, la localisation ou le statut de plusieurs équipements (tracé au journal). */
export async function modifierEquipementsEnMasse(formData: FormData): Promise<Resultat> {
  const saisie = schemaModificationGroupee.safeParse({
    ids: formData.getAll("ids"),
    univers_id: formData.get("univers_id") ?? "",
    categorie_id: formData.get("categorie_id") ?? "",
    localisation_id: formData.get("localisation_id") ?? "",
    statut: formData.get("statut") ?? "",
  });
  if (!saisie.success) return { erreur: premierMessage(saisie.error, LIBELLES) };
  const { ids, modifications } = saisie.data;
  let n = 0;
  const echec = await executer(async (tx) => {
    n = await modifierEnMasse(tx, ids, modifications);
  });
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: `${n} équipement${n > 1 ? "s" : ""} modifié${n > 1 ? "s" : ""}.` };
}
