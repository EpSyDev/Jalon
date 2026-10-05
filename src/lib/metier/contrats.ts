// Alerte de fin de contrat : la date utile est la limite pour donner le préavis,
// pas la date de fin elle-même. Dates au format AAAA-MM-JJ.

import { addDays, format, parseISO } from "date-fns";

export type AlerteContrat = "echu" | "preavis_depasse" | "a_decider";

const ISO = "yyyy-MM-dd";

/** Dernier jour pour dénoncer le contrat (date de fin − préavis). */
export function limitePreavis(dateFin: string, preavisJours: number | null): string {
  return format(addDays(parseISO(dateFin), -(preavisJours ?? 0)), ISO);
}

/** null = rien à signaler. Sans date de fin, aucune alerte possible. */
export function alerteContrat(
  contrat: { date_fin: string | null; preavis_jours: number | null },
  aujourdhui: string,
  seuilJours: number,
): AlerteContrat | null {
  if (!contrat.date_fin) return null;
  if (contrat.date_fin < aujourdhui) return "echu";
  const limite = limitePreavis(contrat.date_fin, contrat.preavis_jours);
  if (limite < aujourdhui) return "preavis_depasse";
  if (limite <= format(addDays(parseISO(aujourdhui), seuilJours), ISO)) return "a_decider";
  return null;
}
