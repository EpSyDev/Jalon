// Relevés périodiques : schémas de saisie, retard et dépassement de seuil. Fonctions pures, testées.
// Aucun seuil n'est proposé par Jalon : ils viennent de l'utilisateur. Dates au format AAAA-MM-JJ.

import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import { aujourdhuiParis } from "./echeance";
import { texteObligatoire, texteOptionnel, uuidOptionnel } from "./saisie";

export type StatutReleve = "jamais" | "en_retard" | "du_jour" | "a_jour";

export const LIBELLES_STATUT_RELEVE: Record<StatutReleve, string> = {
  jamais: "Jamais relevé",
  en_retard: "En retard",
  du_jour: "À faire aujourd'hui",
  a_jour: "À jour",
};

/** Ordre d'affichage : le plus urgent d'abord. */
export const ORDRE_STATUT_RELEVE: StatutReleve[] = ["en_retard", "jamais", "du_jour", "a_jour"];

const ISO = "yyyy-MM-dd";

/** Prochain relevé attendu : dernier relevé + périodicité en jours. */
export function prochainReleve(dernier: string | null, periodiciteJours: number): string | null {
  return dernier === null ? null : format(addDays(parseISO(dernier), periodiciteJours), ISO);
}

/** Le jour de l'échéance, le relevé est « à faire aujourd'hui » : ce n'est un retard qu'à partir du lendemain. */
export function statutReleve(dernier: string | null, periodiciteJours: number, aujourdhui: string): StatutReleve {
  const prochain = prochainReleve(dernier, periodiciteJours);
  if (prochain === null) return "jamais";
  if (prochain < aujourdhui) return "en_retard";
  return prochain === aujourdhui ? "du_jour" : "a_jour";
}

/** « bas » sous le seuil minimal, « haut » au-dessus du seuil maximal, null sinon (les seuils inclus sont acceptés). */
export function horsSeuil(valeur: number, min: number | null, max: number | null): "bas" | "haut" | null {
  if (min !== null && valeur < min) return "bas";
  if (max !== null && valeur > max) return "haut";
  return null;
}

/** 12.5 → « 12,5 » ; avec unité : « 12,5 °C ». */
export function formaterValeur(valeur: number, unite: string | null): string {
  const texte = String(Math.round(valeur * 10_000) / 10_000).replace(".", ",");
  return unite ? `${texte} ${unite}` : texte;
}

/** Libellé des seuils : « entre 5 et 10 °C », « au plus 10 °C », « au moins 5 °C », ou null. */
export function libelleSeuils(min: number | null, max: number | null, unite: string | null): string | null {
  const u = unite ? ` ${unite}` : "";
  const f = (v: number) => formaterValeur(v, null);
  if (min !== null && max !== null) return `entre ${f(min)} et ${f(max)}${u}`;
  if (max !== null) return `au plus ${f(max)}${u}`;
  if (min !== null) return `au moins ${f(min)}${u}`;
  return null;
}

/** Nombre saisi à la française (« 12,5 », « 1 234,5 », « -3 ») ; null si vide, NaN si illisible. */
export function lireNombre(saisie: string): number | null {
  const t = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (t === "") return null;
  return /^-?\d{1,10}(\.\d{1,4})?$/.test(t) ? Number(t) : Number.NaN;
}

const nombreOptionnel = z
  .string()
  .default("")
  .transform((v, ctx) => {
    const n = lireNombre(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "nombre invalide (ex. : 12,5)" });
      return z.NEVER;
    }
    return n;
  });

export const schemaPointReleve = z
  .object({
    libelle: texteObligatoire(200),
    unite: texteOptionnel(20),
    equipement_id: uuidOptionnel,
    localisation_id: uuidOptionnel,
    periodicite_jours: z.coerce
      .number({ error: "nombre de jours attendu" })
      .int("nombre entier de jours")
      .min(1, "au moins 1 jour")
      .max(366, "366 jours maximum"),
    seuil_min: nombreOptionnel,
    seuil_max: nombreOptionnel,
    notes: texteOptionnel(2000),
    actif: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((p) => p.seuil_min === null || p.seuil_max === null || p.seuil_min <= p.seuil_max, {
    message: "le seuil minimal dépasse le seuil maximal",
    path: ["seuil_min"],
  });

export const schemaReleve = z.object({
  valeur: z.string().transform((v, ctx) => {
    const n = lireNombre(v);
    if (n === null || Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "valeur numérique attendue (ex. : 12,5)" });
      return z.NEVER;
    }
    return n;
  }),
  date_releve: z.iso
    .date("date invalide")
    .refine((d) => d <= aujourdhuiParis(), "ne peut pas être dans le futur")
    .optional(),
  commentaire: texteOptionnel(2000),
});
