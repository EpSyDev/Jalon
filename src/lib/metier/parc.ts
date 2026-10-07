// Parc matériel : schémas de saisie et synthèse des statuts d'un équipement.

import { z } from "zod";
import { aujourdhuiParis, type StatutEcheance } from "./echeance";

export const STATUTS_EQUIPEMENT = ["en_service", "hors_service", "reforme"] as const;

const texteOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const uuidOptionnel = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const schemaEquipement = z.object({
  code: z
    .string()
    .trim()
    .min(1, "obligatoire")
    .max(60, "60 caractères maximum")
    .regex(/^[^\s/\\?#]+$/, "sans espace ni / \\ ? #"),
  libelle: z.string().trim().min(1, "obligatoire").max(200, "200 caractères maximum"),
  univers_id: uuidOptionnel,
  famille_id: uuidOptionnel,
  localisation_id: uuidOptionnel,
  marque: texteOptionnel(120),
  modele: texteOptionnel(120),
  numero_serie: texteOptionnel(120),
  date_mise_en_service: z
    .union([z.iso.date("date invalide"), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null)
    .refine((d) => d === null || d <= aujourdhuiParis(), "ne peut pas être dans le futur"),
  statut: z.enum(STATUTS_EQUIPEMENT, "statut obligatoire"),
  notes: texteOptionnel(2000),
});

export const schemaUnivers = z.object({
  libelle: z.string().trim().min(1, "obligatoire").max(120, "120 caractères maximum"),
  description: texteOptionnel(500),
});

export const schemaLocalisation = z.object({
  batiment: z.string().trim().min(1, "obligatoire").max(120, "120 caractères maximum"),
  niveau: texteOptionnel(60),
  local: texteOptionnel(120),
});

/** Rattachement modifié en masse : "" = inchangé, "aucun" = retirer, sinon l'identifiant cible. */
const rattachement = z
  .union([z.literal(""), z.literal("aucun"), z.uuid()])
  .default("")
  .transform((v) => (v === "" ? undefined : v === "aucun" ? null : v));

export const MAX_SELECTION = 500;

/** Modification groupée de plusieurs équipements (univers, localisation, statut). */
export const schemaModificationGroupee = z
  .object({
    ids: z.array(z.uuid()).min(1, "aucun équipement sélectionné").max(MAX_SELECTION, `${MAX_SELECTION} au maximum`),
    univers_id: rattachement,
    localisation_id: rattachement,
    statut: z
      .union([z.literal(""), z.enum(STATUTS_EQUIPEMENT)])
      .default("")
      .transform((v) => (v === "" ? undefined : v)),
  })
  .transform(({ ids, ...champs }) => ({
    ids: [...new Set(ids)],
    // Seuls les champs réellement modifiés sont écrits.
    modifications: Object.fromEntries(Object.entries(champs).filter(([, v]) => v !== undefined)) as {
      univers_id?: string | null;
      localisation_id?: string | null;
      statut?: (typeof STATUTS_EQUIPEMENT)[number];
    },
  }))
  .refine((m) => Object.keys(m.modifications).length > 0, { message: "choisissez au moins une modification" });

const GRAVITE: StatutEcheance[] = ["en_retard", "jamais_controle", "a_echeance", "a_jour"];

/** Statut le plus urgent parmi les plans d'un équipement (null si aucun plan actif). */
export function statutLePlusUrgent(statuts: StatutEcheance[]): StatutEcheance | null {
  for (const s of GRAVITE) if (statuts.includes(s)) return s;
  return null;
}

/** Chemin interne de redirection après connexion : jamais vers un autre site. */
export function cheminSur(suite: unknown): string {
  if (typeof suite !== "string") return "/";
  return /^\/(?![/\\])[^\s]*$/.test(suite) ? suite : "/";
}
