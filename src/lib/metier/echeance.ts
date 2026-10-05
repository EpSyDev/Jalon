// Calcul des échéances de contrôle. Miroir exact des fonctions SQL
// prochaine_echeance / statut_echeance (migration 20261006000400_echeances.sql).
// Dates manipulées au format ISO « AAAA-MM-JJ » pour éviter tout décalage de fuseau.

import { addDays, addMonths, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const FUSEAU = "Europe/Paris";

export type StatutEcheance = "jamais_controle" | "en_retard" | "a_echeance" | "a_jour";

const ISO = "yyyy-MM-dd";

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return formatInTimeZone(maintenant, FUSEAU, ISO);
}

/** Dernier contrôle + périodicité. Fin de mois gérée (31/01 + 1 mois = 28 ou 29/02). */
export function prochaineEcheance(dernierControle: string | null, periodiciteMois: number): string | null {
  if (dernierControle === null) return null;
  return format(addMonths(parseISO(dernierControle), periodiciteMois), ISO);
}

export function statutEcheance(echeance: string | null, aujourdhui: string, seuilJours: number): StatutEcheance {
  if (echeance === null) return "jamais_controle";
  if (echeance < aujourdhui) return "en_retard";
  if (echeance <= format(addDays(parseISO(aujourdhui), seuilJours), ISO)) return "a_echeance";
  return "a_jour";
}
