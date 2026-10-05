// Libellés et formats d'affichage (français, dates JJ/MM/AAAA).

import type { StatutEcheance } from "@/lib/metier/echeance";

/** « 2026-10-06 » → « 06/10/2026 ». */
export function formaterDate(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

export const LIBELLES_STATUT: Record<StatutEcheance, string> = {
  jamais_controle: "Jamais contrôlé",
  en_retard: "En retard",
  a_echeance: "À échéance",
  a_jour: "À jour",
};

/** Ordre de priorité d'affichage : les trous et retards d'abord. */
export const ORDRE_STATUT: StatutEcheance[] = ["en_retard", "jamais_controle", "a_echeance", "a_jour"];

export const LIBELLES_CARACTERE = {
  reglementaire: "Réglementaire",
  obligatoire: "Obligatoire",
  interne: "Interne",
} as const;

export const LIBELLES_RESULTAT = {
  conforme: "Conforme",
  avec_reserves: "Avec réserves",
  non_conforme: "Non conforme",
} as const;

export const LIBELLES_GRAVITE = {
  mineure: "Mineure",
  majeure: "Majeure",
  critique: "Critique",
} as const;
