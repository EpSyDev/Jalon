// Retards des interventions et des chantiers : ce qui est prévu pour une date passée et n'est pas terminé.
// Dates au format AAAA-MM-JJ (comparaison de chaînes). Fonctions pures, testées.

import { differenceInCalendarDays, parseISO } from "date-fns";

const INTERVENTION_CLOSE = ["terminee", "annulee"];
const CHANTIER_ACTIF = ["prevu", "en_cours", "suspendu"];

/** Intervention non terminée dont la date prévue est dépassée (le jour même n'est pas encore un retard). */
export function interventionEnRetard(i: { statut: string; date_prevue: string | null }, aujourdhui: string): boolean {
  return !INTERVENTION_CLOSE.includes(i.statut) && i.date_prevue !== null && i.date_prevue < aujourdhui;
}

export type RetardChantier = "fin_depassee" | "debut_depasse";

/** Chantier actif dont la fin prévue est passée, ou « prévu » alors que son début est passé. */
export function retardChantier(
  c: { statut: string; date_debut: string | null; date_fin_prevue: string | null },
  aujourdhui: string,
): RetardChantier | null {
  if (!CHANTIER_ACTIF.includes(c.statut)) return null;
  if (c.date_fin_prevue !== null && c.date_fin_prevue < aujourdhui) return "fin_depassee";
  if (c.statut === "prevu" && c.date_debut !== null && c.date_debut < aujourdhui) return "debut_depasse";
  return null;
}

/** « depuis 3 jours » / « depuis 1 jour ». */
export function depuisJours(date: string, aujourdhui: string): string {
  const n = differenceInCalendarDays(parseISO(aujourdhui), parseISO(date));
  return `depuis ${n} jour${n > 1 ? "s" : ""}`;
}

export function messageRetardChantier(
  c: { date_debut: string | null; date_fin_prevue: string | null },
  retard: RetardChantier,
  aujourdhui: string,
): string {
  const fr = (d: string) => d.split("-").reverse().join("/");
  return retard === "fin_depassee"
    ? `Fin prévue le ${fr(c.date_fin_prevue!)} (${depuisJours(c.date_fin_prevue!, aujourdhui)})`
    : `Devait démarrer le ${fr(c.date_debut!)} (${depuisJours(c.date_debut!, aujourdhui)})`;
}
