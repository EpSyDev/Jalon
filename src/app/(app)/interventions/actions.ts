"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, RefusMetier, valider, type Resultat } from "@/lib/actions";
import {
  appliquerTransition,
  schemaChantier,
  schemaIntervention,
  schemaTransition,
  type StatutIntervention,
} from "@/lib/metier/interventions";

const LIBELLES: Record<string, string> = {
  type: "Type",
  titre: "Titre",
  description: "Description",
  priorite: "Priorité",
  date_prevue: "Date prévue",
  statut: "Statut",
  date_cloture: "Date de clôture",
  date_debut: "Date de début",
  date_fin_prevue: "Fin prévue",
  date_fin_reelle: "Fin réelle",
  notes: "Notes",
};

function rafraichir() {
  revalidatePath("/", "layout");
}

// --- Interventions -------------------------------------------------------------

export async function creerIntervention(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaIntervention, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.interventions ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/interventions/${id}`);
}

export async function modifierIntervention(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaIntervention, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.interventions set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/interventions/${id}`);
}

export async function changerStatut(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaTransition, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer(async (tx) => {
    const [actuel] = await tx<{ statut: StatutIntervention; date_demande: string }[]>`
      select statut, date_demande from public.interventions where id = ${id} and archive_le is null for update`;
    if (!actuel) throw new RefusMetier("Intervention introuvable.");
    const etat = appliquerTransition(actuel, donnees.statut, donnees.date_cloture);
    if ("erreur" in etat) throw new RefusMetier(etat.erreur);
    await tx`update public.interventions set statut = ${etat.statut}, date_cloture = ${etat.date_cloture} where id = ${id}`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
}

export async function archiverIntervention(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.interventions set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/interventions");
}

// --- Chantiers -----------------------------------------------------------------

export async function creerChantier(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaChantier, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.chantiers ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/chantiers/${id}`);
}

export async function modifierChantier(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaChantier, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.chantiers set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/chantiers/${id}`);
}

export async function archiverChantier(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.interventions
      where chantier_id = ${id} and archive_le is null and statut not in ('terminee', 'annulee')`;
    if (n > 0) throw new RefusMetier(`${n} intervention(s) encore ouverte(s) sur ce chantier.`);
    await tx`update public.chantiers set archive_le = now() where id = ${id}`;
  }, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/chantiers");
}
