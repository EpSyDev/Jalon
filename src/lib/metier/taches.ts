// Tâches en cours : pense-bête partagé, ouvert jusqu'à résolution.

import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { dateOptionnelle, texteObligatoire, texteOptionnel } from "./saisie";

export const schemaTache = z.object({
  libelle: texteObligatoire(200),
  notes: texteOptionnel(2000),
  echeance: dateOptionnelle,
});

/** Jours de retard (> 0) d'une tâche ouverte dont l'échéance est dépassée, sinon null. */
export function retardTache(echeance: string | null, aujourdhui: string): number | null {
  if (!echeance) return null;
  const jours = differenceInCalendarDays(parseISO(aujourdhui), parseISO(echeance));
  return jours > 0 ? jours : null;
}
