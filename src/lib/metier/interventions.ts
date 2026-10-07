// Interventions et chantiers : schémas de saisie et cycle de vie (fonctions pures, testées).

import { z } from "zod";
import { dateOptionnelle, texteOptionnel, uuidOptionnel } from "./saisie";
import { aujourdhuiParis } from "./echeance";

export const STATUTS_INTERVENTION = ["a_faire", "en_cours", "en_attente", "terminee", "annulee"] as const;
export type StatutIntervention = (typeof STATUTS_INTERVENTION)[number];
export const PRIORITES = ["basse", "normale", "haute", "urgente"] as const;
export const TYPES_INTERVENTION = ["corrective", "preventive", "autre"] as const;
export const STATUTS_CHANTIER = ["prevu", "en_cours", "suspendu", "termine", "annule"] as const;

export const LIBELLES_STATUT_INTERVENTION: Record<StatutIntervention, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  terminee: "Terminée",
  annulee: "Annulée",
};
export const LIBELLES_PRIORITE = { basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" } as const;
export const LIBELLES_TYPE_INTERVENTION = {
  corrective: "Corrective",
  preventive: "Préventive",
  autre: "Autre",
} as const;
export const LIBELLES_STATUT_CHANTIER = {
  prevu: "Prévu",
  en_cours: "En cours",
  suspendu: "Suspendu",
  termine: "Terminé",
  annule: "Annulé",
} as const;

/** Transitions autorisées depuis chaque statut. */
const TRANSITIONS: Record<StatutIntervention, StatutIntervention[]> = {
  a_faire: ["en_cours", "en_attente", "terminee", "annulee"],
  en_cours: ["en_attente", "terminee", "annulee"],
  en_attente: ["en_cours", "terminee", "annulee"],
  terminee: ["en_cours"],
  annulee: ["a_faire"],
};

export function transitionsPossibles(statut: StatutIntervention): StatutIntervention[] {
  return TRANSITIONS[statut];
}

export const estCloture = (s: StatutIntervention) => s === "terminee" || s === "annulee";

/**
 * Nouvel état après transition. La clôture exige une date (≥ date de demande, pas dans le futur) ;
 * la réouverture efface la date de clôture. Renvoie un message d'erreur si la transition est refusée.
 */
export function appliquerTransition(
  actuel: { statut: StatutIntervention; date_demande: string },
  cible: StatutIntervention,
  dateCloture: string | null,
  aujourdhui: string = aujourdhuiParis(),
): { statut: StatutIntervention; date_cloture: string | null } | { erreur: string } {
  if (!TRANSITIONS[actuel.statut].includes(cible)) {
    return {
      erreur: `Passage de « ${LIBELLES_STATUT_INTERVENTION[actuel.statut]} » à « ${LIBELLES_STATUT_INTERVENTION[cible]} » impossible.`,
    };
  }
  if (!estCloture(cible)) return { statut: cible, date_cloture: null };
  const date = dateCloture ?? aujourdhui;
  if (date > aujourdhui) return { erreur: "La date de clôture ne peut pas être dans le futur." };
  if (date < actuel.date_demande) return { erreur: "La date de clôture précède la date de demande." };
  return { statut: cible, date_cloture: date };
}

/** Tri : urgentes d'abord, puis date prévue la plus proche. */
export function comparerInterventions(
  a: { priorite: (typeof PRIORITES)[number]; date_prevue: string | null },
  b: { priorite: (typeof PRIORITES)[number]; date_prevue: string | null },
): number {
  const p = PRIORITES.indexOf(b.priorite) - PRIORITES.indexOf(a.priorite);
  if (p !== 0) return p;
  return (a.date_prevue ?? "9999") < (b.date_prevue ?? "9999") ? -1 : a.date_prevue === b.date_prevue ? 0 : 1;
}

// --- Schémas de saisie ---------------------------------------------------------

export const schemaIntervention = z.object({
  type: z.enum(TYPES_INTERVENTION),
  titre: z.string().trim().min(1, "obligatoire").max(200, "200 caractères maximum"),
  description: texteOptionnel(2000),
  equipement_id: uuidOptionnel,
  plan_controle_id: uuidOptionnel,
  chantier_id: uuidOptionnel,
  priorite: z.enum(PRIORITES),
  date_prevue: dateOptionnelle,
  assignee_id: uuidOptionnel,
  prestataire_id: uuidOptionnel,
});

export const schemaTransition = z.object({
  statut: z.enum(STATUTS_INTERVENTION),
  date_cloture: dateOptionnelle,
});

export const schemaChantier = z
  .object({
    titre: z.string().trim().min(1, "obligatoire").max(200, "200 caractères maximum"),
    description: texteOptionnel(2000),
    statut: z.enum(STATUTS_CHANTIER),
    date_debut: dateOptionnelle,
    date_fin_prevue: dateOptionnelle,
    date_fin_reelle: dateOptionnelle,
    responsable_id: uuidOptionnel,
    notes: texteOptionnel(2000),
  })
  .superRefine((c, ctx) => {
    if (c.date_debut && c.date_fin_prevue && c.date_fin_prevue < c.date_debut) {
      ctx.addIssue({ code: "custom", path: ["date_fin_prevue"], message: "antérieure à la date de début" });
    }
    if (c.date_debut && c.date_fin_reelle && c.date_fin_reelle < c.date_debut) {
      ctx.addIssue({ code: "custom", path: ["date_fin_reelle"], message: "antérieure à la date de début" });
    }
    if (c.statut === "termine" && !c.date_fin_reelle) {
      ctx.addIssue({ code: "custom", path: ["date_fin_reelle"], message: "obligatoire pour un chantier terminé" });
    }
    if (c.date_fin_reelle && c.date_fin_reelle > aujourdhuiParis()) {
      ctx.addIssue({ code: "custom", path: ["date_fin_reelle"], message: "ne peut pas être dans le futur" });
    }
  });
