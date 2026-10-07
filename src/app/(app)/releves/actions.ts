"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, RefusMetier, valider, type Resultat } from "@/lib/actions";
import { formaterValeur, horsSeuil, libelleSeuils, schemaPointReleve, schemaReleve } from "@/lib/metier/releves";

const LIBELLES: Record<string, string> = {
  libelle: "Libellé",
  unite: "Unité",
  equipement_id: "Équipement",
  localisation_id: "Localisation",
  periodicite_jours: "Périodicité",
  seuil_min: "Seuil minimal",
  seuil_max: "Seuil maximal",
  notes: "Notes",
  valeur: "Valeur",
  date_releve: "Date",
  commentaire: "Commentaire",
};

const rafraichir = () => {
  revalidatePath("/releves", "layout");
  revalidatePath("/");
};

export async function creerPoint(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaPointReleve, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.points_releve ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/releves/${id}`);
}

export async function modifierPoint(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaPointReleve, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.points_releve set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/releves/${id}`);
}

export async function archiverPoint(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.points_releve set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/releves");
}

/** Enregistre un relevé. Une valeur hors des seuils est enregistrée (c'est un fait) puis signalée. */
export async function enregistrerReleve(pointId: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(pointId)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaReleve, formData, LIBELLES);
  if (!ok) return { erreur };
  let message = "Relevé enregistré.";
  const echec = await executer(async (tx) => {
    const [point] = await tx<{ unite: string | null; seuil_min: number | null; seuil_max: number | null }[]>`
      select unite, seuil_min::float8 as seuil_min, seuil_max::float8 as seuil_max
      from public.points_releve where id = ${pointId} and archive_le is null and actif`;
    if (!point) throw new RefusMetier("Point de relevé inactif ou archivé : rechargez la page.");
    await tx`
      insert into public.releves (point_id, valeur, date_releve, commentaire)
      values (${pointId}, ${donnees.valeur}, coalesce(${donnees.date_releve ?? null}::date, public.aujourdhui()),
        ${donnees.commentaire})`;
    const depasse = horsSeuil(donnees.valeur, point.seuil_min, point.seuil_max);
    if (depasse) {
      message = `Enregistré, mais ${formaterValeur(donnees.valeur, point.unite)} est ${
        depasse === "bas" ? "en dessous" : "au-dessus"
      } du seuil (${libelleSeuils(point.seuil_min, point.seuil_max, point.unite)}).`;
    }
  });
  if (echec) return { erreur: echec };
  rafraichir();
  return { message };
}
