// Suivi des formations et habilitations : saisie et état de validité. L'échéance se déduit du type de formation
// (validité en mois) sauf si elle est saisie à la main.

import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import { z } from "zod";
import { dateIso, dateOptionnelle, texteObligatoire, texteOptionnel, uuidOptionnel } from "./saisie";

const nombreOptionnel = (min: number, max: number, entier: boolean) =>
  z
    .union([z.literal(""), z.coerce.number({ error: "nombre attendu" })])
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .number()
        .min(min, `${min} au minimum`)
        .max(max, `${max} au maximum`)
        .refine((v) => !entier || Number.isInteger(v), "nombre entier")
        .nullable(),
    )
    .default(null);

export const schemaAgent = z.object({
  nom: texteObligatoire(200),
  fonction: texteOptionnel(120),
  notes: texteOptionnel(2000),
});

export const schemaTypeFormation = z.object({
  libelle: texteObligatoire(200),
  validite_mois: nombreOptionnel(1, 240, true),
  notes: texteOptionnel(2000),
});

const verifierEcheance = (v: { date_formation: string; echeance: string | null }, ctx: z.RefinementCtx) => {
  if (v.echeance && v.echeance < v.date_formation)
    ctx.addIssue({ code: "custom", path: ["echeance"], message: "antérieure à la formation" });
};

export const schemaFormation = z
  .object({
    agent_id: uuidOptionnel,
    agent_nouveau: texteOptionnel(200),
    type_formation_id: uuidOptionnel,
    type_nouveau: texteOptionnel(200),
    validite_mois_nouveau: nombreOptionnel(1, 240, true),
    date_formation: dateIso,
    duree_heures: nombreOptionnel(0.5, 9999, false),
    organisme: texteOptionnel(200),
    echeance: dateOptionnelle,
    notes: texteOptionnel(2000),
  })
  .superRefine((v, ctx) => {
    if (!v.agent_id && !v.agent_nouveau)
      ctx.addIssue({ code: "custom", path: ["agent_id"], message: "à choisir ou à saisir" });
    if (!v.type_formation_id && !v.type_nouveau)
      ctx.addIssue({ code: "custom", path: ["type_formation_id"], message: "à choisir ou à saisir" });
    verifierEcheance(v, ctx);
  });

/** Modification d'une formation existante (l'agent et le type ne changent pas). */
export const schemaModifFormation = z
  .object({
    date_formation: dateIso,
    duree_heures: nombreOptionnel(0.5, 9999, false),
    organisme: texteOptionnel(200),
    echeance: dateOptionnelle,
    notes: texteOptionnel(2000),
  })
  .superRefine(verifierEcheance);

/** Échéance = date de formation + validité du type ; null si le type n'a pas de validité. */
export function calculerEcheance(dateFormation: string, validiteMois: number | null): string | null {
  return validiteMois ? format(addMonths(parseISO(dateFormation), validiteMois), "yyyy-MM-dd") : null;
}

export type StatutFormation = "expiree" | "bientot" | "valide" | "sans_echeance";

export const LIBELLES_STATUT_FORMATION: Record<StatutFormation, string> = {
  expiree: "Expirée",
  bientot: "À renouveler bientôt",
  valide: "Valide",
  sans_echeance: "Sans échéance",
};

/** L'échéance est le dernier jour de validité : expirée dès le lendemain, « bientôt » dès le seuil. */
export function statutFormation(echeance: string | null, aujourdhui: string, seuilJours: number): StatutFormation {
  if (!echeance) return "sans_echeance";
  const jours = differenceInCalendarDays(parseISO(echeance), parseISO(aujourdhui));
  if (jours < 0) return "expiree";
  return jours <= seuilJours ? "bientot" : "valide";
}

export function joursAvantEcheance(echeance: string, aujourdhui: string): number {
  return differenceInCalendarDays(parseISO(echeance), parseISO(aujourdhui));
}

/** « 3 ans », « 18 mois »… */
export function libelleValidite(mois: number | null): string {
  if (!mois) return "Sans échéance";
  if (mois % 12 === 0) return `${mois / 12} an${mois >= 24 ? "s" : ""}`;
  return `${mois} mois`;
}
