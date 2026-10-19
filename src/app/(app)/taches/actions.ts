"use server";

import { revalidatePath } from "next/cache";
import { executer, ID_INVALIDE, idsValides, valider, type Resultat } from "@/lib/actions";
import { schemaTache } from "@/lib/metier/taches";

const LIBELLES: Record<string, string> = {
  libelle: "Tâche",
  notes: "Précision",
  echeance: "Échéance",
};

const rafraichir = () => revalidatePath("/", "layout");

export async function creerTache(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaTache, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.taches ${tx(donnees)}`);
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: "Tâche ajoutée." };
}

export async function resoudreTache(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(
    (tx) =>
      tx`update public.taches set resolue_le = now(), resolue_par = auth.uid() where id = ${id} and resolue_le is null`,
  );
  if (echec) return { erreur: echec };
  rafraichir();
}

export async function rouvrirTache(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(
    (tx) =>
      tx`update public.taches set resolue_le = null, resolue_par = null where id = ${id} and resolue_le is not null`,
  );
  if (echec) return { erreur: echec };
  rafraichir();
}
