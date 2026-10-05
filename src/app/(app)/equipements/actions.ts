"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, RefusMetier, valider, type Resultat } from "@/lib/actions";
import { schemaEquipement, schemaLocalisation } from "@/lib/metier/parc";

const LIBELLES: Record<string, string> = {
  code: "Code",
  libelle: "Libellé",
  famille_id: "Famille",
  localisation_id: "Localisation",
  marque: "Marque",
  modele: "Modèle",
  numero_serie: "N° de série",
  date_mise_en_service: "Mise en service",
  statut: "Statut",
  notes: "Notes",
  batiment: "Bâtiment",
  niveau: "Niveau",
  local: "Local",
};

function rafraichir() {
  revalidatePath("/", "layout");
}

export async function creerEquipement(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaEquipement, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.equipements ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec.replace("Cet élément existe déjà.", "Ce code d'équipement existe déjà.") };
  rafraichir();
  redirect(`/equipements/${id}`);
}

export async function modifierEquipement(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaEquipement, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.equipements set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec.replace("Cet élément existe déjà.", "Ce code d'équipement existe déjà.") };
  rafraichir();
  redirect(`/equipements/${id}`);
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
