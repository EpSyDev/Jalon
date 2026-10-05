// Schémas de saisie du module Contrôles (partagés client/serveur) et règles de cohérence.
// Les bornes reprennent les contraintes CHECK de la base : la base reste la dernière ligne de défense.

import { z } from "zod";
import { aujourdhuiParis } from "./echeance";

export const CARACTERES = ["reglementaire", "obligatoire", "interne"] as const;
export const RESULTATS = ["conforme", "avec_reserves", "non_conforme"] as const;
export const GRAVITES = ["mineure", "majeure", "critique"] as const;

const TEXTE_LIBRE = 2000;

/** Champ texte facultatif : vide → null. */
const texteOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const texteObligatoire = (max: number) => z.string().trim().min(1, "obligatoire").max(max, `${max} caractères maximum`);

const uuidOptionnel = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

const dateIso = z.iso.date("date invalide (JJ/MM/AAAA)");

const dateOptionnelle = z
  .union([dateIso, z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

const periodicite = z.coerce
  .number({ error: "nombre de mois attendu" })
  .int("nombre entier de mois")
  .min(1, "au moins 1 mois")
  .max(120, "120 mois maximum");

export const schemaFamille = z.object({
  libelle: texteObligatoire(120),
});

export const schemaTypeControle = z.object({
  libelle: texteObligatoire(200),
  famille_id: z.uuid("famille obligatoire"),
  caractere: z.enum(CARACTERES, "caractère obligatoire"),
  periodicite_mois: periodicite,
  reference_texte: texteOptionnel(500),
  notes: texteOptionnel(TEXTE_LIBRE),
});

export const schemaPlanControle = z
  .object({
    type_controle_id: z.uuid("type de contrôle obligatoire"),
    equipement_id: uuidOptionnel,
    perimetre_libelle: texteOptionnel(200),
    prestataire_id: uuidOptionnel,
    contrat_id: uuidOptionnel,
    periodicite_mois_surcharge: z
      .union([z.literal(""), periodicite])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
    actif: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((p) => p.equipement_id !== null || p.perimetre_libelle !== null, {
    message: "indiquer un équipement ou un périmètre",
    path: ["perimetre_libelle"],
  });

export const schemaControle = z
  .object({
    plan_controle_id: z.uuid("plan de contrôle obligatoire"),
    date_realisation: dateIso,
    resultat: z.enum(RESULTATS, "résultat obligatoire"),
    nb_reserves_declare: z.coerce
      .number({ error: "nombre attendu" })
      .int("nombre entier")
      .min(0, "nombre positif")
      .max(500, "500 maximum")
      .default(0),
    reference_rapport: texteOptionnel(500),
    commentaire: texteOptionnel(TEXTE_LIBRE),
  })
  .superRefine((c, ctx) => {
    const erreur = incoherenceResultat(c.resultat, c.nb_reserves_declare);
    if (erreur) ctx.addIssue({ code: "custom", message: erreur, path: ["nb_reserves_declare"] });
  });

export const schemaReserve = z.object({
  description: texteObligatoire(TEXTE_LIBRE),
  gravite: z
    .union([z.enum(GRAVITES), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  echeance_levee: dateOptionnelle,
  commentaire: texteOptionnel(TEXTE_LIBRE),
});

export const schemaLeveeReserve = z.object({
  date_levee: dateIso.refine((d) => d <= aujourdhuiParis(), "ne peut pas être dans le futur"),
});

/**
 * Cohérence entre le résultat déclaré et le nombre de réserves.
 * Simple garde-fou de saisie, pas une règle réglementaire.
 */
export function incoherenceResultat(resultat: (typeof RESULTATS)[number], nbReserves: number): string | null {
  if (resultat === "conforme" && nbReserves > 0) return "un contrôle conforme ne peut pas avoir de réserves";
  if (resultat === "avec_reserves" && nbReserves === 0) return "indiquer le nombre de réserves";
  return null;
}

/** Premier message d'erreur Zod, préfixé du libellé du champ concerné. */
export function premierMessage(erreur: z.ZodError, libelles: Record<string, string>): string {
  const issue = erreur.issues[0];
  const champ = issue.path[0];
  const libelle = typeof champ === "string" ? libelles[champ] : undefined;
  return libelle ? `${libelle} : ${issue.message}` : issue.message;
}
