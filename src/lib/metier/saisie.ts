// Briques de validation communes aux formulaires (partagées client/serveur). Champ vide → null.

import { z } from "zod";

export const texteOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

export const texteObligatoire = (max: number) =>
  z.string().trim().min(1, "obligatoire").max(max, `${max} caractères maximum`);

export const uuidOptionnel = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const dateIso = z.iso.date("date invalide (JJ/MM/AAAA)");

export const dateOptionnelle = z
  .union([dateIso, z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);
