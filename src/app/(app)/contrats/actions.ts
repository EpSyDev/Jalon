"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, RefusMetier, valider, type Resultat } from "@/lib/actions";
import { schemaContrat, schemaPrestataire } from "@/lib/metier/contrats";

const LIBELLES: Record<string, string> = {
  nom: "Nom",
  contact_nom: "Contact",
  email: "Adresse mail",
  telephone: "Téléphone",
  notes: "Notes",
  prestataire_id: "Prestataire",
  objet: "Objet",
  reference: "Référence",
  date_debut: "Date de début",
  date_fin: "Date de fin",
  preavis_jours: "Préavis",
  montant_annuel: "Montant annuel",
  reference_document: "Référence du document",
};

function rafraichir() {
  revalidatePath("/", "layout");
}

// --- Prestataires --------------------------------------------------------------

export async function creerPrestataire(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaPrestataire, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    const [doublon] = await tx`select 1 from public.prestataires
      where archive_le is null and public.normaliser(nom) = public.normaliser(${donnees.nom})`;
    if (doublon) throw new RefusMetier("Un prestataire porte déjà ce nom.");
    [{ id }] = await tx<{ id: string }[]>`insert into public.prestataires ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/prestataires/${id}`);
}

export async function modifierPrestataire(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaPrestataire, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.prestataires set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/prestataires/${id}`);
}

export async function archiverPrestataire(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`
      select (select count(*) from public.contrats where prestataire_id = ${id} and archive_le is null)
        + (select count(*) from public.plans_controle where prestataire_id = ${id} and archive_le is null) as n`;
    if (Number(n) > 0)
      throw new RefusMetier("Contrats ou plans encore rattachés : archivez-les ou réaffectez-les d'abord.");
    await tx`update public.prestataires set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/prestataires");
}

// --- Contrats ------------------------------------------------------------------

export async function creerContrat(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaContrat, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.contrats ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/contrats/${id}`);
}

export async function modifierContrat(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaContrat, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.contrats set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/contrats/${id}`);
}

export async function archiverContrat(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    // Les plans gardent leur historique : on détache simplement le contrat archivé.
    await tx`update public.plans_controle set contrat_id = null where contrat_id = ${id}`;
    await tx`update public.contrats set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/contrats");
}
