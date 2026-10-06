// Stocks : schémas de saisie. Le stock courant est calculé en base (v_stocks), jamais stocké.

import { z } from "zod";
import { aujourdhuiParis } from "./echeance";

/** Quantité saisie à la française (« 2,5 ») : 3 décimales au plus. */
export function lireQuantite(saisie: string): number | "invalide" | null {
  const t = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(t)) return "invalide";
  return Number(t);
}

const quantite = (obligatoire: boolean) =>
  z
    .string()
    .default("")
    .transform((v, ctx) => {
      const q = lireQuantite(v);
      if (q === "invalide" || (obligatoire && (q === null || q <= 0))) {
        ctx.addIssue({
          code: "custom",
          message: obligatoire ? "quantité positive attendue (ex. : 2,5)" : "nombre invalide",
        });
        return z.NEVER;
      }
      return q;
    });

const texteOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

export const schemaArticle = z.object({
  reference: texteOptionnel(60),
  libelle: z.string().trim().min(1, "obligatoire").max(200, "200 caractères maximum"),
  unite: texteOptionnel(20),
  seuil_alerte: quantite(false),
  notes: texteOptionnel(2000),
});

export const schemaMouvement = z.object({
  sens: z.enum(["entree", "sortie"]),
  quantite: quantite(true),
  date_mouvement: z.iso.date("date invalide").refine((d) => d <= aujourdhuiParis(), "ne peut pas être dans le futur"),
  commentaire: texteOptionnel(2000),
});

/** Affichage d'une quantité : pas de décimales inutiles. */
export function formaterQuantite(q: number | string, unite?: string | null): string {
  const n = Number(q).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  return unite ? `${n} ${unite}` : n;
}
