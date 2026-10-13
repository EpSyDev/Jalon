"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN,
  executer,
  ID_INVALIDE,
  idsValides,
  RefusMetier,
  supprimerFiche,
  valider,
  type Resultat,
} from "@/lib/actions";
import { premierMessage, schemaNouveauControle } from "@/lib/metier/controles";
import { schemaEpi } from "@/lib/metier/epi";
import { FAMILLE_GROUPE, TYPE_ESSAI } from "@/lib/requetes/groupe-electrogene";
import { creerControleComplet } from "@/lib/requetes/nouveau-controle";

const LIBELLES: Record<string, string> = {
  libelle: "Libellé",
  detail: "Détail",
  quantite: "Quantité",
  date_peremption: "Date de péremption",
  localisation_id: "Localisation",
  notes: "Notes",
  equipement_id: "Équipement",
  perimetre_libelle: "Désignation",
  date_dernier: "Dernier essai",
};

const rafraichir = () => revalidatePath("/", "layout");

/**
 * Met en place le suivi mensuel de l'essai en charge d'un groupe : un plan de contrôle « interne », tous les mois,
 * dans la famille « Groupe électrogène » (les rappels, « Aujourd'hui » et la tournée le prennent en compte).
 */
export async function mettreEnPlaceEssai(formData: FormData): Promise<Resultat> {
  const dernier = String(formData.get("date_dernier") ?? "");
  const saisie = schemaNouveauControle.safeParse({
    famille_nouvelle: FAMILLE_GROUPE,
    caractere: "interne",
    libelle: TYPE_ESSAI,
    periodicite_mois: "1",
    equipement_id: formData.get("equipement_id") ?? "",
    perimetre_libelle: formData.get("perimetre_libelle") ?? "",
    date_dernier: dernier,
    resultat: dernier ? "conforme" : "",
  });
  if (!saisie.success) return { erreur: premierMessage(saisie.error, LIBELLES) };
  const echec = await executer(async (tx) => {
    const r = await creerControleComplet(tx, saisie.data);
    if (r.erreur) throw new RefusMetier(r.erreur);
  });
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Suivi mensuel en place. Le prochain essai apparaît ci-dessous." };
}

export async function creerEpi(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaEpi, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.epi ${tx(donnees)}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/groupe-electrogene");
}

export async function modifierEpi(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaEpi, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.epi set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/groupe-electrogene");
}

export async function archiverEpi(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.epi set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/groupe-electrogene");
}

export async function supprimerEpi(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => supprimerFiche(tx, "epi", id), ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/groupe-electrogene");
}
