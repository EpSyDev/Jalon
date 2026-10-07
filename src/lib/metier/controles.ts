// Schémas de saisie du module Contrôles (partagés client/serveur) et règles de cohérence.
// Les bornes reprennent les contraintes CHECK de la base : la base reste la dernière ligne de défense.

import { z } from "zod";
import { dateIso, dateOptionnelle, texteObligatoire, texteOptionnel, uuidOptionnel } from "./saisie";
import { aujourdhuiParis } from "./echeance";

export const CARACTERES = ["reglementaire", "obligatoire", "interne"] as const;
export const RESULTATS = ["conforme", "avec_reserves", "non_conforme"] as const;
export const GRAVITES = ["mineure", "majeure", "critique"] as const;

const TEXTE_LIBRE = 2000;

/** Champ texte facultatif : vide → null. */
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

/**
 * Création d'un contrôle en un seul formulaire : famille, caractère, intitulé, périodicité, périmètre, et le dernier
 * contrôle connu (facultatif). Le type et le plan correspondants sont créés (ou retrouvés) en une fois.
 */
export const schemaNouveauControle = z
  .object({
    famille_id: uuidOptionnel,
    famille_nouvelle: texteOptionnel(120),
    caractere: z.enum(CARACTERES, "caractère obligatoire"),
    libelle: texteObligatoire(200),
    periodicite_mois: periodicite,
    reference_texte: texteOptionnel(500),
    equipement_id: uuidOptionnel,
    perimetre_libelle: texteOptionnel(200),
    prestataire_id: uuidOptionnel,
    date_dernier: dateOptionnelle,
    resultat: z
      .union([z.enum(RESULTATS), z.literal("")])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
    nb_reserves_declare: z.coerce.number({ error: "nombre attendu" }).int("nombre entier").min(0).max(500).default(0),
  })
  .superRefine((c, ctx) => {
    if ((c.famille_id === null) === (c.famille_nouvelle === null)) {
      ctx.addIssue({ code: "custom", path: ["famille_id"], message: "choisir une famille, ou en saisir une nouvelle" });
    }
    if (c.equipement_id === null && c.perimetre_libelle === null) {
      ctx.addIssue({ code: "custom", path: ["perimetre_libelle"], message: "indiquer un équipement ou un périmètre" });
    }
    if (c.date_dernier !== null) {
      if (c.date_dernier > aujourdhuiParis()) {
        ctx.addIssue({ code: "custom", path: ["date_dernier"], message: "ne peut pas être dans le futur" });
      }
      if (c.resultat === null) {
        ctx.addIssue({ code: "custom", path: ["resultat"], message: "indiquer le résultat de ce dernier contrôle" });
      } else {
        const erreur = incoherenceResultat(c.resultat, c.nb_reserves_declare);
        if (erreur) ctx.addIssue({ code: "custom", path: ["nb_reserves_declare"], message: erreur });
      }
    }
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

export type GroupeCaractere<P> = { caractere: (typeof CARACTERES)[number]; plans: P[] };
export type GroupeFamille<P> = { famille_id: string; famille: string; groupes: GroupeCaractere<P>[] };

/** Famille (ordre alphabétique) → caractère (réglementaire, obligatoire, interne) → contrôles, dans l'ordre reçu. */
export function grouperControles<
  P extends { famille_id: string; famille_libelle: string; caractere: (typeof CARACTERES)[number] },
>(plans: P[]): GroupeFamille<P>[] {
  const familles = new Map<string, GroupeFamille<P>>();
  for (const p of plans) {
    let f = familles.get(p.famille_id);
    if (!f) familles.set(p.famille_id, (f = { famille_id: p.famille_id, famille: p.famille_libelle, groupes: [] }));
    let g = f.groupes.find((x) => x.caractere === p.caractere);
    if (!g) f.groupes.push((g = { caractere: p.caractere, plans: [] }));
    g.plans.push(p);
  }
  for (const f of familles.values())
    f.groupes.sort((a, b) => CARACTERES.indexOf(a.caractere) - CARACTERES.indexOf(b.caractere));
  return [...familles.values()].sort((a, b) => a.famille.localeCompare(b.famille, "fr"));
}
