// Fraîcheur de la dernière sauvegarde : l'offre gratuite de Supabase n'en fournit aucune, tout repose sur l'export
// téléchargé. Fonctions pures, testées. Dates de Paris au format AAAA-MM-JJ.

import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { FUSEAU } from "./echeance";

export const CLE_DERNIERE_SAUVEGARDE = "derniere_sauvegarde";
export const SEUIL_SAUVEGARDE_JOURS = 7;

export type EtatSauvegarde =
  { niveau: "ok"; jours: number } | { niveau: "ancienne"; jours: number } | { niveau: "jamais" };

/** Instant ISO de la dernière sauvegarde (ou null) → état à la date du jour (Paris). */
export function etatSauvegarde(derniere: string | null, aujourdhui: string): EtatSauvegarde {
  if (!derniere || Number.isNaN(Date.parse(derniere))) return { niveau: "jamais" };
  const jour = formatInTimeZone(new Date(derniere), FUSEAU, "yyyy-MM-dd");
  const jours = Math.max(0, differenceInCalendarDays(parseISO(aujourdhui), parseISO(jour)));
  return { niveau: jours > SEUIL_SAUVEGARDE_JOURS ? "ancienne" : "ok", jours };
}

/** Message d'alerte, ou null si la sauvegarde est récente. */
export function messageSauvegarde(e: EtatSauvegarde): string | null {
  if (e.niveau === "ok") return null;
  if (e.niveau === "jamais") return "Aucune sauvegarde n'a jamais été téléchargée.";
  return `Dernière sauvegarde il y a ${e.jours} jours (plus de ${SEUIL_SAUVEGARDE_JOURS}).`;
}
