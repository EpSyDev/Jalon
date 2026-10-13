// Annuaire de contacts : schéma de saisie. Coordonnées professionnelles uniquement.

import { z } from "zod";
import { texteObligatoire, texteOptionnel, uuidOptionnel } from "./saisie";

export const schemaContact = z.object({
  nom: texteObligatoire(200),
  organisation: texteOptionnel(200),
  fonction: texteOptionnel(120),
  telephone: texteOptionnel(30).refine((t) => t === null || /^[0-9+().\s-]{3,30}$/.test(t), "numéro invalide"),
  email: z
    .union([z.email("adresse mail invalide").max(254), z.literal("")])
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .default(null),
  notes: texteOptionnel(2000),
  prestataire_id: uuidOptionnel,
});

/** Lien « appeler » : chiffres et « + » seulement (le numéro affiché reste tel que saisi). */
export function lienTelephone(telephone: string): string {
  return `tel:${telephone.replace(/[^\d+]/g, "")}`;
}

type Presentation = { nom: string; organisation: string | null; fonction: string | null };

/** Titre d'un contact : la société d'abord (plus parlant), à défaut le nom de la personne. */
export function titreContact(c: Presentation): string {
  return c.organisation ?? c.nom;
}

/** Sous le titre : la personne (si la société est en titre) puis sa fonction. */
export function sousTitreContact(c: Presentation): string {
  return [c.organisation ? c.nom : null, c.fonction].filter(Boolean).join(" · ");
}
