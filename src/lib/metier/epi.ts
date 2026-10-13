// EPI (équipements de protection individuelle) : saisie et état de péremption. Aucune durée de validité n'est
// proposée par Jalon : la date de péremption est celle indiquée sur l'équipement ou par le fabricant.

import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { dateOptionnelle, texteObligatoire, texteOptionnel, uuidOptionnel } from "./saisie";

export const schemaEpi = z.object({
  libelle: texteObligatoire(200),
  detail: texteOptionnel(120),
  quantite: z.coerce
    .number({ error: "nombre attendu" })
    .int("nombre entier")
    .min(1, "1 au minimum")
    .max(9999)
    .default(1),
  date_peremption: dateOptionnelle,
  localisation_id: uuidOptionnel,
  notes: texteOptionnel(2000),
});

export type StatutEpi = "perime" | "bientot" | "ok" | "sans_date";

export const LIBELLES_STATUT_EPI: Record<StatutEpi, string> = {
  perime: "Périmé",
  bientot: "À remplacer bientôt",
  ok: "Valide",
  sans_date: "Sans date",
};

/** La date de péremption est le dernier jour d'usage : périmé à partir du lendemain, « à remplacer bientôt » dès le seuil. */
export function statutEpi(datePeremption: string | null, aujourdhui: string, seuilJours: number): StatutEpi {
  if (!datePeremption) return "sans_date";
  const jours = differenceInCalendarDays(parseISO(datePeremption), parseISO(aujourdhui));
  if (jours < 0) return "perime";
  return jours <= seuilJours ? "bientot" : "ok";
}

/** Jours avant péremption (négatif si périmé). */
export function joursAvantPeremption(datePeremption: string, aujourdhui: string): number {
  return differenceInCalendarDays(parseISO(datePeremption), parseISO(aujourdhui));
}
