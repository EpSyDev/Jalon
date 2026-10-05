// Alerte de fin de contrat : la date utile est la limite pour donner le préavis,
// pas la date de fin elle-même. Dates au format AAAA-MM-JJ.

import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

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

// --- Saisie : prestataires et contrats ------------------------------------------

const texteOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const dateOptionnelle = z
  .union([z.iso.date("date invalide"), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const schemaPrestataire = z.object({
  nom: z.string().trim().min(1, "obligatoire").max(200, "200 caractères maximum"),
  contact_nom: texteOptionnel(200),
  email: z
    .union([z.email("adresse mail invalide").max(254), z.literal("")])
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .default(null),
  telephone: texteOptionnel(30).refine((t) => t === null || /^[0-9+().\s-]{6,30}$/.test(t), "numéro invalide"),
  notes: texteOptionnel(2000),
});

/** Montant saisi à la française (« 1 234,56 ») → nombre, ou null si vide. */
export function lireMontant(saisie: string): number | null | "invalide" {
  const t = saisie.replace(/[\s  €]/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(t)) return "invalide";
  return Number(t);
}

export const schemaContrat = z
  .object({
    prestataire_id: z.uuid("prestataire obligatoire"),
    objet: z.string().trim().min(1, "obligatoire").max(300, "300 caractères maximum"),
    reference: texteOptionnel(120),
    date_debut: dateOptionnelle,
    date_fin: dateOptionnelle,
    reconduction_tacite: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === "on"),
    preavis_jours: z
      .union([z.literal(""), z.coerce.number().int("nombre entier de jours").min(0).max(730, "730 jours maximum")])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
    montant_annuel: z
      .string()
      .default("")
      .transform((v, ctx) => {
        const m = lireMontant(v);
        if (m === "invalide") {
          ctx.addIssue({ code: "custom", message: "montant invalide (ex. : 1 234,56)" });
          return z.NEVER;
        }
        return m;
      }),
    reference_document: texteOptionnel(500),
    notes: texteOptionnel(2000),
  })
  .refine((c) => !c.date_debut || !c.date_fin || c.date_fin >= c.date_debut, {
    message: "antérieure à la date de début",
    path: ["date_fin"],
  });
