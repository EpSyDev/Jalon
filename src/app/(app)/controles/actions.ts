"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  ADMIN,
  executer,
  ID_INVALIDE,
  idsValides,
  RefusMetier,
  valider as validerAvec,
  type Resultat,
} from "@/lib/actions";
import {
  schemaControle,
  schemaFamille,
  schemaLeveeReserve,
  schemaNouveauControle,
  schemaPlanControle,
  schemaReserve,
  schemaTypeControle,
} from "@/lib/metier/controles";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { cheminSur } from "@/lib/metier/parc";
import { creerControleComplet } from "@/lib/requetes/nouveau-controle";

const LIBELLES: Record<string, string> = {
  libelle: "Libellé",
  famille_id: "Famille",
  caractere: "Caractère",
  periodicite_mois: "Périodicité",
  periodicite_mois_surcharge: "Périodicité spécifique",
  reference_texte: "Référence du texte",
  notes: "Notes",
  type_controle_id: "Type de contrôle",
  perimetre_libelle: "Périmètre",
  plan_controle_id: "Plan de contrôle",
  date_realisation: "Date de réalisation",
  resultat: "Résultat",
  nb_reserves_declare: "Nombre de réserves",
  reference_rapport: "Référence du rapport",
  commentaire: "Commentaire",
  description: "Description",
  gravite: "Gravité",
  echeance_levee: "Échéance de levée",
  date_levee: "Date de levée",
  famille_nouvelle: "Nouvelle famille",
  date_dernier: "Date du dernier contrôle",
  equipement_id: "Équipement",
  prestataire_id: "Prestataire",
};

const valider = <S extends z.ZodType>(schema: S, formData: FormData) => validerAvec(schema, formData, LIBELLES);

function rafraichir() {
  revalidatePath("/controles", "layout");
  revalidatePath("/");
}

// --- Familles et types ------------------------------------------------------

export async function creerFamille(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaFamille, formData);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.familles_controle ${tx(donnees)}`.then(() => {}));
  if (echec) return { erreur: echec };
  rafraichir();
}

export async function creerType(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaTypeControle, formData);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.types_controle ${tx(donnees)}`.then(() => {}));
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/controles/types");
}

export async function modifierType(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaTypeControle, formData);
  if (!ok) return { erreur };
  const echec = await executer((tx) =>
    tx`update public.types_controle set ${tx(donnees)} where id = ${id}`.then(() => {}),
  );
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/controles/types");
}

export async function archiverType(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.plans_controle where type_controle_id = ${id} and archive_le is null`;
    if (n > 0) throw new RefusMetier(`Ce type est utilisé par ${n} plan(s) : archivez-les d'abord.`);
    await tx`update public.types_controle set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/controles/types");
}

// --- Nouveau contrôle (formulaire unique) ------------------------------------

export async function creerNouveauControle(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaNouveauControle, formData);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    const r = await creerControleComplet(tx, donnees);
    if (r.erreur !== undefined) throw new RefusMetier(r.erreur);
    id = r.id;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${id}`);
}

// --- Plans ------------------------------------------------------------------

export async function creerPlan(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaPlanControle, formData);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.plans_controle ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${id}`);
}

export async function modifierPlan(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaPlanControle, formData);
  if (!ok) return { erreur };
  const echec = await executer((tx) =>
    tx`update public.plans_controle set ${tx(donnees)} where id = ${id}`.then(() => {}),
  );
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${id}`);
}

export async function archiverPlan(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(
    (tx) => tx`update public.plans_controle set archive_le = now() where id = ${id}`.then(() => {}),
    ADMIN,
  );
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/controles");
}

// --- Contrôles --------------------------------------------------------------

export async function enregistrerControle(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaControle, formData);
  if (!ok) return { erreur };
  const echec = await executer(async (tx) => {
    const [{ id }] = await tx<{ id: string }[]>`insert into public.controles ${tx(donnees)} returning id`;
    // Saisie rapide : les réserves déclarées sans détail sont créées « à détailler ».
    if (donnees.nb_reserves_declare > 0) {
      await tx`
        insert into public.reserves (controle_id, date_constat)
        select ${id}, ${donnees.date_realisation}::date from generate_series(1, ${donnees.nb_reserves_declare})`;
    }
  });
  if (echec) return { erreur: echec };
  rafraichir();
  const retour = cheminSur(formData.get("retour"));
  redirect(retour.startsWith("/controles/tournee") ? retour : `/controles/plans/${donnees.plan_controle_id}`);
}

/** Tournée : contrôle conforme réalisé aujourd'hui, en une touche (après confirmation à l'écran). */
export async function controleConformeAujourdhui(planId: string): Promise<Resultat> {
  if (!idsValides(planId)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [plan] = await tx`
      select 1 from public.v_plans_controle_echeance where plan_controle_id = ${planId}`;
    if (!plan) throw new RefusMetier("Plan inactif ou archivé : rechargez la page.");
    await tx`
      insert into public.controles (plan_controle_id, date_realisation, resultat, nb_reserves_declare)
      values (${planId}, ${aujourdhuiParis()}, 'conforme', 0)`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Contrôle conforme enregistré." };
}

/** Retire un contrôle saisi par erreur (archivage, admin). */
export async function archiverControle(planId: string, controleId: string): Promise<Resultat> {
  if (!idsValides(planId, controleId)) return ID_INVALIDE;
  const echec = await executer(
    (tx) => tx`update public.controles set archive_le = now() where id = ${controleId}`.then(() => {}),
    ADMIN,
  );
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${planId}`);
}

// --- Réserves ---------------------------------------------------------------

export async function modifierReserve(id: string, planId: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id, planId)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaReserve, formData);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.reserves set ${tx(donnees)} where id = ${id}`.then(() => {}));
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${planId}`);
}

export async function leverReserve(id: string, planId: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id, planId)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaLeveeReserve, formData);
  if (!ok) return { erreur };
  const echec = await executer((tx) =>
    tx`update public.reserves set statut = 'levee', date_levee = ${donnees.date_levee} where id = ${id}`.then(() => {}),
  );
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${planId}`);
}

export async function rouvrirReserve(id: string, planId: string): Promise<Resultat> {
  if (!idsValides(id, planId)) return ID_INVALIDE;
  const echec = await executer((tx) =>
    tx`update public.reserves set statut = 'ouverte', date_levee = null where id = ${id}`.then(() => {}),
  );
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/controles/plans/${planId}`);
}
