// Parc matériel : statuts, schémas de saisie, filtres de la liste et synthèse des contrôles d'un équipement.

import { z } from "zod";
import { dateIso, dateOptionnelle, texteOptionnel, uuidOptionnel } from "./saisie";
import { aujourdhuiParis, type StatutEcheance } from "./echeance";

// --- Statuts ------------------------------------------------------------------------

export const STATUTS_EQUIPEMENT = [
  "en_service",
  "indisponible",
  "reparation_interne",
  "reparation_externe",
  "hors_service",
  "declasse",
  "reforme",
] as const;

export type StatutEquipement = (typeof STATUTS_EQUIPEMENT)[number];

export const LIBELLES_STATUT_EQUIPEMENT: Record<StatutEquipement, string> = {
  en_service: "En service",
  indisponible: "Indisponible",
  reparation_interne: "En réparation (interne)",
  reparation_externe: "En réparation (externe)",
  hors_service: "Hors service",
  declasse: "Déclassé",
  reforme: "Réformé",
};

export const AIDES_STATUT_EQUIPEMENT: Record<StatutEquipement, string> = {
  en_service: "Disponible et utilisé.",
  indisponible: "Momentanément indisponible : prêté, isolé, en attente…",
  reparation_interne: "Réparé par le service technique.",
  reparation_externe: "Parti chez un prestataire ou le fabricant.",
  hors_service: "En panne, aucune réparation en cours.",
  declasse: "Retiré de l'usage mais encore présent. Plus d'alerte de contrôle.",
  reforme: "Sorti définitivement du parc. Plus d'alerte de contrôle.",
};

/** Matériel présent dans le parc mais qu'on ne peut pas utiliser aujourd'hui. */
export const STATUTS_INDISPONIBLES = [
  "indisponible",
  "reparation_interne",
  "reparation_externe",
  "hors_service",
] as const satisfies readonly StatutEquipement[];

/** Matériel retiré du parc : masqué par défaut, plus d'alerte de contrôle. */
export const STATUTS_RETIRES = ["declasse", "reforme"] as const satisfies readonly StatutEquipement[];

export const GROUPES_STATUT = [
  { libelle: "Disponible", statuts: ["en_service"] },
  { libelle: "Indisponible", statuts: STATUTS_INDISPONIBLES },
  { libelle: "Retiré du parc", statuts: STATUTS_RETIRES },
] as const satisfies readonly { libelle: string; statuts: readonly StatutEquipement[] }[];

export function estIndisponible(statut: StatutEquipement): boolean {
  return (STATUTS_INDISPONIBLES as readonly string[]).includes(statut);
}

export function estRetire(statut: StatutEquipement): boolean {
  return (STATUTS_RETIRES as readonly string[]).includes(statut);
}

// --- Schémas de saisie ------------------------------------------------------------------

const champsInfos = {
  code: z
    .string()
    .trim()
    .min(1, "obligatoire")
    .max(60, "60 caractères maximum")
    .regex(/^[^\s/\\?#]+$/, "sans espace ni / \\ ? #"),
  libelle: z.string().trim().min(1, "obligatoire").max(200, "200 caractères maximum"),
  univers_id: uuidOptionnel,
  categorie_id: uuidOptionnel,
  /** Catégorie créée à la volée dans l'univers choisi (ou retrouvée si elle existe déjà). */
  categorie_nouvelle: texteOptionnel(120),
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
  notes: texteOptionnel(2000),
};

const uneSeuleCategorie = (d: { categorie_id: string | null; categorie_nouvelle: string | null }) =>
  !(d.categorie_id && d.categorie_nouvelle);
const PAS_LES_DEUX = {
  message: "choisissez une catégorie existante ou saisissez-en une nouvelle, pas les deux",
  path: ["categorie_nouvelle"],
};

/** Informations d'un équipement (modifiées sur sa fiche) ; le statut a son propre formulaire. */
export const schemaInfosEquipement = z.object(champsInfos).refine(uneSeuleCategorie, PAS_LES_DEUX);

/** Création : informations et statut de départ. */
export const schemaEquipement = z
  .object({ ...champsInfos, statut: z.enum(STATUTS_EQUIPEMENT, "statut obligatoire") })
  .refine(uneSeuleCategorie, PAS_LES_DEUX);

/** Changement de statut depuis la fiche : les précisions sans objet pour le statut choisi sont effacées. */
export const schemaStatut = z
  .object({
    statut: z.enum(STATUTS_EQUIPEMENT, "statut obligatoire"),
    statut_depuis: z
      .union([dateIso, z.literal("")])
      .default("")
      .transform((v) => v || aujourdhuiParis())
      .refine((d) => d <= aujourdhuiParis(), "ne peut pas être dans le futur"),
    statut_motif: texteOptionnel(500),
    statut_prestataire_id: uuidOptionnel,
    statut_retour_prevu: dateOptionnelle,
    creer_intervention: z
      .literal("on")
      .optional()
      .transform((v) => v === "on"),
  })
  .transform((d) => ({
    ...d,
    statut_prestataire_id: d.statut === "reparation_externe" ? d.statut_prestataire_id : null,
    statut_retour_prevu: estIndisponible(d.statut) ? d.statut_retour_prevu : null,
    creer_intervention:
      d.creer_intervention && (d.statut === "reparation_interne" || d.statut === "reparation_externe"),
  }))
  .refine((d) => !d.statut_retour_prevu || d.statut_retour_prevu >= d.statut_depuis, {
    message: "ne peut pas précéder le début du statut",
    path: ["statut_retour_prevu"],
  });

export const schemaUnivers = z.object({
  libelle: z.string().trim().min(1, "obligatoire").max(120, "120 caractères maximum"),
  description: texteOptionnel(500),
});

export const schemaCategorie = z.object({
  libelle: z.string().trim().min(1, "obligatoire").max(120, "120 caractères maximum"),
  univers_id: uuidOptionnel,
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

/** Modification groupée de plusieurs équipements (univers, catégorie, localisation, statut). */
export const schemaModificationGroupee = z
  .object({
    ids: z.array(z.uuid()).min(1, "aucun équipement sélectionné").max(MAX_SELECTION, `${MAX_SELECTION} au maximum`),
    univers_id: rattachement,
    categorie_id: rattachement,
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
      categorie_id?: string | null;
      localisation_id?: string | null;
      statut?: StatutEquipement;
    },
  }))
  .refine((m) => Object.keys(m.modifications).length > 0, { message: "choisissez au moins une modification" });

// --- Filtres de la liste --------------------------------------------------------------

/** Filtres de statut groupés, en plus de chaque statut. Sans filtre : le matériel en parc (hors retirés). */
export const FILTRES_STATUT_GROUPES = { indisponibles: STATUTS_INDISPONIBLES, retires: STATUTS_RETIRES } as const;

export function filtreStatutValide(v: string | undefined): string | undefined {
  return v && (v in FILTRES_STATUT_GROUPES || v === "tous" || (STATUTS_EQUIPEMENT as readonly string[]).includes(v))
    ? v
    : undefined;
}

export function statutsDuFiltre(filtre: string | undefined): readonly StatutEquipement[] {
  if (!filtre) return STATUTS_EQUIPEMENT.filter((s) => !estRetire(s));
  if (filtre === "tous") return STATUTS_EQUIPEMENT;
  if (filtre in FILTRES_STATUT_GROUPES) return FILTRES_STATUT_GROUPES[filtre as keyof typeof FILTRES_STATUT_GROUPES];
  return STATUTS_EQUIPEMENT.filter((s) => s === filtre);
}

/** Valeur de filtre « sans catégorie » ou « sans localisation ». */
export const AUCUN = "aucun";

export type LigneFiltrable = {
  id: string;
  statut: StatutEquipement;
  categorie_id: string | null;
  localisation_id: string | null;
};

export type FiltresListe = { statut?: string; categorie?: string; localisation?: string };

export type Facettes = {
  /** Identifiants retenus par tous les filtres, dans l'ordre reçu. */
  ids: string[];
  /** Comptes par valeur, chaque facette tenant compte des autres filtres mais pas du sien (clé AUCUN = non renseigné). */
  categories: Record<string, number>;
  localisations: Record<string, number>;
  statuts: Record<StatutEquipement, number>;
};

/**
 * Filtre la liste (déjà restreinte à l'univers et à la recherche) et compte chaque valeur de filtre : on ne propose
 * ainsi que les catégories, localisations et statuts réellement présents, avec leur nombre.
 */
export function filtrerEtCompter(lignes: LigneFiltrable[], filtres: FiltresListe): Facettes {
  const statuts = new Set(statutsDuFiltre(filtres.statut));
  const egal = (valeur: string | null, filtre: string | undefined) =>
    !filtre || (filtre === AUCUN ? valeur === null : valeur === filtre);
  const facettes: Facettes = {
    ids: [],
    categories: {},
    localisations: {},
    statuts: Object.fromEntries(STATUTS_EQUIPEMENT.map((s) => [s, 0])) as Record<StatutEquipement, number>,
  };
  const ajouter = (compte: Record<string, number>, cle: string | null) => {
    compte[cle ?? AUCUN] = (compte[cle ?? AUCUN] ?? 0) + 1;
  };
  for (const l of lignes) {
    const okStatut = statuts.has(l.statut);
    const okCategorie = egal(l.categorie_id, filtres.categorie);
    const okLocalisation = egal(l.localisation_id, filtres.localisation);
    if (okCategorie && okLocalisation) facettes.statuts[l.statut]++;
    if (okStatut && okLocalisation) ajouter(facettes.categories, l.categorie_id);
    if (okStatut && okCategorie) ajouter(facettes.localisations, l.localisation_id);
    if (okStatut && okCategorie && okLocalisation) facettes.ids.push(l.id);
  }
  return facettes;
}

// --- Synthèse -------------------------------------------------------------------------

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

/** Retour après une saisie de contrôle : la tournée ou le suivi du groupe électrogène, sinon la fiche du plan. */
export function retourControle(suite: unknown): string | null {
  const chemin = cheminSur(suite);
  return chemin.startsWith("/controles/tournee") || chemin === "/groupe-electrogene" ? chemin : null;
}
