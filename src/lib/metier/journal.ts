// Lecture humaine du journal d'audit (alimenté par triggers) : quels champs ont changé, avant → après.
// Fonctions pures, testées. Aucune interprétation : on montre exactement ce qui a été enregistré.

export type Entree = {
  id: number | string;
  table_cible: string;
  enregistrement_id: string;
  action: "insert" | "update" | "archive";
  utilisateur_nom: string | null;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  cree_le: string | Date;
};

export type Changement = { champ: string; avant: string; apres: string };

export const LIBELLES_TABLE: Record<string, string> = {
  equipements: "Équipement",
  univers: "Univers",
  localisations: "Localisation",
  familles_controle: "Famille",
  types_controle: "Type de contrôle",
  plans_controle: "Plan de contrôle",
  controles: "Contrôle",
  reserves: "Réserve",
  prestataires: "Prestataire",
  contacts: "Contact",
  points_releve: "Point de relevé",
  releves: "Relevé",
  contrats: "Contrat",
  interventions: "Intervention",
  chantiers: "Chantier",
  articles_stock: "Article de stock",
  mouvements_stock: "Mouvement de stock",
  parametres: "Paramètre",
  profils: "Utilisateur",
};

export const LIBELLES_ACTION = { insert: "Création", update: "Modification", archive: "Archivage" } as const;

const LIBELLES_CHAMP: Record<string, string> = {
  code: "Code",
  libelle: "Libellé",
  statut: "Statut",
  nom: "Nom",
  role: "Rôle",
  titre: "Titre",
  objet: "Objet",
  description: "Description",
  notes: "Notes",
  commentaire: "Commentaire",
  reference: "Référence",
  reference_texte: "Référence du texte",
  reference_rapport: "Référence du rapport",
  reference_document: "Référence du document",
  caractere: "Caractère",
  periodicite_mois: "Périodicité (mois)",
  periodicite_mois_surcharge: "Périodicité spécifique (mois)",
  perimetre_libelle: "Périmètre",
  actif: "Actif",
  date_realisation: "Date de réalisation",
  resultat: "Résultat",
  nb_reserves_declare: "Réserves déclarées",
  gravite: "Gravité",
  date_constat: "Constat",
  echeance_levee: "Échéance de levée",
  date_levee: "Levée",
  date_debut: "Début",
  date_fin: "Fin",
  date_fin_prevue: "Fin prévue",
  date_fin_reelle: "Fin réelle",
  reconduction_tacite: "Reconduction tacite",
  preavis_jours: "Préavis (jours)",
  montant_annuel: "Montant annuel",
  priorite: "Priorité",
  type: "Type",
  date_demande: "Demande",
  date_prevue: "Prévue",
  date_cloture: "Clôture",
  date_mise_en_service: "Mise en service",
  marque: "Marque",
  modele: "Modèle",
  numero_serie: "N° de série",
  batiment: "Bâtiment",
  niveau: "Niveau",
  local: "Local",
  contact_nom: "Contact",
  email: "Mail",
  telephone: "Téléphone",
  organisation: "Organisation",
  fonction: "Fonction",
  univers_id: "Univers",
  famille_id: "Famille",
  localisation_id: "Localisation",
  prestataire_id: "Prestataire",
  contrat_id: "Contrat",
  equipement_id: "Équipement",
  type_controle_id: "Type de contrôle",
  plan_controle_id: "Plan de contrôle",
  chantier_id: "Chantier",
  assignee_id: "Assigné à",
  responsable_id: "Responsable",
  archive_le: "Archivage",
  valeur: "Valeur",
  sens: "Sens",
  quantite: "Quantité",
  date_mouvement: "Date",
  unite: "Unité",
  seuil_alerte: "Seuil d'alerte",
  seuil_min: "Seuil minimal",
  seuil_max: "Seuil maximal",
  periodicite_jours: "Périodicité (jours)",
  date_releve: "Date du relevé",
  point_id: "Point de relevé",
};

/** Valeurs codées (statuts, résultats, rôles…) : libellé affiché. */
const VALEURS: Record<string, string> = {
  en_service: "En service",
  hors_service: "Hors service",
  reforme: "Réformé",
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  terminee: "Terminée",
  annulee: "Annulée",
  prevu: "Prévu",
  suspendu: "Suspendu",
  termine: "Terminé",
  annule: "Annulé",
  conforme: "Conforme",
  avec_reserves: "Avec réserves",
  non_conforme: "Non conforme",
  ouverte: "Ouverte",
  levee: "Levée",
  mineure: "Mineure",
  majeure: "Majeure",
  critique: "Critique",
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
  corrective: "Corrective",
  preventive: "Préventive",
  reglementaire: "Réglementaire",
  obligatoire: "Obligatoire",
  interne: "Interne",
  admin: "Administrateur",
  technicien: "Technicien",
  lecture: "Lecture seule",
  entree: "Entrée",
  sortie: "Sortie",
};

/** Colonnes techniques jamais affichées. */
const IGNOREES = new Set(["id", "created_at", "updated_at", "created_by", "updated_by", "qr_token", "libelle_complet"]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Valeur lisible : date JJ/MM/AAAA, oui/non, identifiant lié signalé comme tel, texte tronqué. */
export function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "string") {
    if (ISO_DATE.test(v)) return v.split("-").reverse().join("/");
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10).split("-").reverse().join("/");
    if (UUID.test(v)) return "(élément lié)";
    if (VALEURS[v]) return VALEURS[v];
    return v.length > 80 ? `${v.slice(0, 79)}…` : v;
  }
  const json = JSON.stringify(v);
  return json.length > 80 ? `${json.slice(0, 79)}…` : json;
}

export function libelleChamp(colonne: string): string {
  return LIBELLES_CHAMP[colonne] ?? colonne.replaceAll("_", " ");
}

/** Identifiants liés (univers, localisation…) cités par des entrées : à nommer en base. */
export function idsLies(entrees: Pick<Entree, "avant" | "apres">[]): string[] {
  const ids = new Set<string>();
  for (const e of entrees) {
    for (const x of [e.avant, e.apres]) {
      for (const [c, v] of Object.entries(x ?? {})) {
        if (c.endsWith("_id") && typeof v === "string" && UUID.test(v)) ids.add(v);
      }
    }
  }
  return [...ids];
}

/**
 * Champs réellement modifiés entre avant et après (création : aucun ; on affiche alors le titre).
 * noms : libellés des éléments liés ; un lien sans nom connu est seulement signalé comme modifié.
 */
export function changements(
  e: Pick<Entree, "action" | "avant" | "apres">,
  noms: Map<string, string> = new Map(),
): Changement[] {
  if (e.action === "insert" || !e.avant || !e.apres) return [];
  const colonnes = new Set([...Object.keys(e.avant), ...Object.keys(e.apres)]);
  const resultat: Changement[] = [];
  for (const c of colonnes) {
    if (IGNOREES.has(c)) continue;
    const a = e.avant[c] ?? null;
    const b = e.apres[c] ?? null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    // Rattachement : le nom de l'élément lié ; à défaut on dit seulement qu'il a changé (l'identifiant n'apprend rien).
    const lie = (v: unknown, defaut: string) => (v ? (noms.get(String(v)) ?? defaut) : "—");
    const estLien = c.endsWith("_id");
    resultat.push({
      champ: libelleChamp(c),
      avant: estLien ? lie(a, "renseigné") : valeurLisible(a),
      apres: estLien ? lie(b, "autre valeur") : valeurLisible(b),
    });
  }
  return resultat;
}

/** Titre de l'enregistrement d'après son contenu (code et libellé, titre, objet, nom…). */
export function titreEnregistrement(e: Pick<Entree, "apres" | "enregistrement_id">): string {
  const x = e.apres ?? {};
  const t = (k: string) => (typeof x[k] === "string" && x[k] !== "" ? (x[k] as string) : null);
  if (t("code") && t("libelle")) return `${t("code")} — ${t("libelle")}`;
  const titre = t("titre") ?? t("objet") ?? t("nom") ?? t("libelle") ?? t("cle") ?? t("description");
  if (titre) return valeurLisible(titre);
  if (t("date_realisation")) return `réalisé le ${valeurLisible(t("date_realisation"))}`;
  if (t("batiment")) return [t("batiment"), t("niveau"), t("local")].filter(Boolean).join(" / ");
  return "";
}

/** Lien vers la fiche concernée, quand elle existe. */
export function lienEnregistrement(e: Pick<Entree, "table_cible" | "enregistrement_id" | "apres">): string | null {
  const id = e.enregistrement_id;
  const x = e.apres ?? {};
  const champ = (k: string) => (typeof x[k] === "string" && UUID.test(x[k] as string) ? (x[k] as string) : null);
  switch (e.table_cible) {
    case "equipements":
      return `/equipements/${id}`;
    case "plans_controle":
      return `/controles/plans/${id}`;
    case "controles":
      return champ("plan_controle_id") && `/controles/plans/${champ("plan_controle_id")}`;
    case "reserves":
      return `/controles/reserves/${id}`;
    case "types_controle":
      return `/controles/types/${id}`;
    case "points_releve":
      return `/releves/${id}`;
    case "releves":
      return champ("point_id") && `/releves/${champ("point_id")}`;
    case "contacts":
      return `/contacts/${id}`;
    case "contrats":
      return `/contrats/${id}`;
    case "prestataires":
      return `/prestataires/${id}`;
    case "interventions":
      return `/interventions/${id}`;
    case "chantiers":
      return `/chantiers/${id}`;
    case "articles_stock":
      return `/stocks/${id}`;
    case "mouvements_stock":
      return champ("article_id") && `/stocks/${champ("article_id")}`;
    case "univers":
      return "/equipements/univers";
    case "localisations":
      return "/equipements/localisations";
    case "parametres":
    case "profils":
      return "/parametres";
    default:
      return null;
  }
}
