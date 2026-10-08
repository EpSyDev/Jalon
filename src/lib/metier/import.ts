// Import Excel/CSV : lecture du tableau, validation ligne par ligne, puis planification
// des créations à partir de l'existant. Tout est pur (aucun accès base) et testé.
// Principe : aucun import silencieux. Une seule erreur bloque tout l'import.

import { isValid, parse } from "date-fns";
import { aujourdhuiParis } from "./echeance";

export type Cellule = string | number | boolean | Date | null;
export type TypeImport = "controles" | "equipements";

type Colonne = { cle: string; entete: string; alias?: string[]; obligatoire?: boolean; aide: string };

export const COLONNES: Record<TypeImport, Colonne[]> = {
  controles: [
    { cle: "famille", entete: "Famille", obligatoire: true, aide: "Ex. : Électricité. Créée si absente." },
    {
      cle: "libelle",
      entete: "Libellé du contrôle",
      alias: ["libelle", "controle", "type de controle"],
      obligatoire: true,
      aide: "Nature du contrôle.",
    },
    {
      cle: "perimetre",
      entete: "Périmètre / équipement",
      alias: ["perimetre", "equipement"],
      obligatoire: true,
      aide: "Code d'un équipement existant, sinon texte libre (ex. : ensemble du site).",
    },
    {
      cle: "caractere",
      entete: "Caractère",
      obligatoire: true,
      aide: "réglementaire, obligatoire ou interne.",
    },
    {
      cle: "periodicite",
      entete: "Périodicité (mois)",
      alias: ["periodicite"],
      obligatoire: true,
      aide: "Nombre entier de mois, de 1 à 120.",
    },
    { cle: "reference", entete: "Référence du texte", alias: ["reference"], aide: "Facultatif." },
    { cle: "prestataire", entete: "Prestataire", aide: "Facultatif. Créé si absent." },
    {
      cle: "dernier_controle",
      entete: "Date du dernier contrôle",
      alias: ["dernier controle"],
      aide: "Facultatif, JJ/MM/AAAA. Évite le statut « jamais contrôlé ».",
    },
    {
      cle: "resultat",
      entete: "Résultat du dernier contrôle",
      alias: ["resultat"],
      aide: "Obligatoire si une date est donnée : conforme, avec réserves ou non conforme.",
    },
  ],
  equipements: [
    {
      cle: "code",
      entete: "Code",
      obligatoire: true,
      aide: "Identifiant unique et lisible (ex. : TGBT-A). Facultatif si vous indiquez un préfixe pour générer les codes.",
    },
    {
      cle: "libelle",
      entete: "Libellé",
      alias: ["designation"],
      aide: "Désignation de l'équipement. À défaut : marque et modèle (ex. : INVACARE Action 2 NG).",
    },
    {
      cle: "univers",
      entete: "Univers",
      aide: "Facultatif. Grand ensemble du parc (ex. : Chauffage-ventilation). Créé si absent.",
    },
    { cle: "famille", entete: "Famille", aide: "Facultatif. Créée si absente." },
    { cle: "batiment", entete: "Bâtiment", aide: "Facultatif. Obligatoire si niveau ou local est rempli." },
    { cle: "niveau", entete: "Niveau", aide: "Facultatif." },
    { cle: "local", entete: "Local", aide: "Facultatif." },
    { cle: "marque", entete: "Marque", aide: "Facultatif." },
    { cle: "modele", entete: "Modèle", alias: ["modele"], aide: "Facultatif." },
    { cle: "numero_serie", entete: "N° de série", alias: ["numero de serie", "n serie", "serie"], aide: "Facultatif." },
    {
      cle: "mise_en_service",
      entete: "Mise en service",
      alias: ["date de mise en service"],
      aide: "Facultatif, JJ/MM/AAAA.",
    },
    { cle: "statut", entete: "Statut", aide: "en service (défaut), hors service ou réformé." },
    {
      cle: "notes",
      entete: "Notes",
      alias: ["observation", "observations", "remarque", "remarques", "commentaire"],
      aide: "Facultatif. Texte repris tel quel dans les notes de l'équipement.",
    },
  ],
};

/** Aide affichée avec le modèle et l'association : le sort des colonnes que Jalon ne connaît pas. */
export const AIDE_AUTRES_COLONNES =
  "Toute autre colonne (n° d'inventaire, service, historique…) est reprise dans les notes de l'équipement, précédée de son titre.";

export const MAX_LIGNES = 5000;

/** Minuscules, sans accents ni ponctuation : sert aux comparaisons tolérantes. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Conversion des cellules ---------------------------------------------------

function texte(c: Cellule | undefined): string | null {
  if (c === null || c === undefined) return null;
  const t = (c instanceof Date ? c.toISOString().slice(0, 10) : String(c)).trim();
  return t === "" ? null : t;
}

/** Date Excel (objet Date en UTC) ou texte JJ/MM/AAAA ou AAAA-MM-JJ → AAAA-MM-JJ. */
export function lireDate(c: Cellule | undefined): { valeur: string | null; erreur?: string } {
  if (c === null || c === undefined || c === "") return { valeur: null };
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return { valeur: null, erreur: "date illisible" };
    return { valeur: c.toISOString().slice(0, 10) };
  }
  const t = String(c).trim();
  for (const motif of ["dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd"]) {
    const d = parse(t, motif, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() >= 1900) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { valeur: iso };
    }
  }
  return { valeur: null, erreur: `date « ${t} » invalide (JJ/MM/AAAA attendu)` };
}

function lireEnum<T extends string>(c: Cellule | undefined, valeurs: Record<string, T>): T | null | undefined {
  const t = texte(c);
  if (t === null) return null;
  return valeurs[normaliser(t)];
}

const CARACTERES = { reglementaire: "reglementaire", obligatoire: "obligatoire", interne: "interne" } as const;
const RESULTATS = {
  conforme: "conforme",
  "avec reserves": "avec_reserves",
  "avec reserve": "avec_reserves",
  "non conforme": "non_conforme",
} as const;
const STATUTS = {
  "en service": "en_service",
  "hors service": "hors_service",
  reforme: "reforme",
} as const;
/** Libellés courants des tableaux de suivi : rattachés au statut le plus proche, l'original est gardé dans les notes. */
const STATUTS_PROCHES = {
  "en maintenance": "hors_service",
  "en panne": "hors_service",
  "en reparation": "hors_service",
  "au rebut": "reforme",
  rebut: "reforme",
} as const;

/** Texte sur une seule ligne (retours à la ligne des cellules Excel remplacés par des espaces). */
function ligne(c: Cellule | undefined): string | null {
  return texte(c)?.replace(/\s+/g, " ") ?? null;
}

/** « ABSENT », « PAS DE N° », « ? », « NS ABSENT »… : la cellule dit qu'il n'y a pas de valeur. */
function valeurAbsente(t: string): boolean {
  const n = normaliser(t);
  return (
    n === "" ||
    /\b(absent|absente|aucun|aucune|inconnu|illisible)\b/.test(n) ||
    /^(pas de|sans)\b/.test(n) ||
    ["na", "n a", "nc", "x", "non"].includes(n)
  );
}

/** Année seule (« 2018 ») : date incomplète, gardée telle quelle dans les notes plutôt qu'inventée. */
function lireAnnee(c: Cellule | undefined): number | null {
  const t = typeof c === "number" || typeof c === "string" ? String(c).trim() : "";
  return /^(19|20)\d{2}$/.test(t) ? Number(t) : null;
}

/** Valeur reprise dans les notes : date au format français, retours à la ligne conservés. */
function texteNote(c: Cellule | undefined): string | null {
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10).split("-").reverse().join("/");
  return texte(c)?.replace(/\r\n?/g, "\n") ?? null;
}

/** Titre de colonne lisible : sur une ligne, raccourci (« VIGILANCE CASE ROUGE = DANGER IMMINENT… »). */
function titreCourt(t: string, max = 40): string {
  const l = t.replace(/\s+/g, " ").trim();
  return l.length > max ? `${l.slice(0, max - 1).trimEnd()}…` : l;
}

// --- Lecture du tableau --------------------------------------------------------

export type LigneBrute = {
  numero: number;
  valeurs: Record<string, Cellule>;
  /** Colonnes non associées à un champ : reprises dans les notes avec leur titre. */
  autres?: { titre: string; valeur: string }[];
  /** Ligne d'une seule cellule (titre de section, commentaire isolé) ou de total : jamais importée. */
  ignoree?: { motif: "titre" | "total"; texte: string };
};

/**
 * Périodicité en mois : « 12 », « 12 mois », « 1 an », « 2 ans ». Tout autre libellé (« annuel »…) est refusé :
 * on ne devine jamais une périodicité réglementaire.
 */
export function lirePeriodicite(brut: string | null): number {
  if (brut === null) return NaN;
  const m = /^(\d+)\s*(mois|m|ans?|a)?$/i.exec(brut.trim());
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2] && /^a/i.test(m[2]) ? n * 12 : n;
}

/** Association champ Jalon → numéro de colonne du fichier (null = non utilisé). */
export type Correspondance = Record<string, number | null>;

export type DemandeCorrespondance = {
  /** Numéro (1-based) de la ligne d'en-têtes retenue dans le fichier. */
  ligne: number;
  /** Titre de chaque colonne, précédé de son groupe quand l'en-tête tient sur deux lignes. */
  entetes: string[];
  champs: { cle: string; entete: string; obligatoire: boolean; aide: string; choix: number | null }[];
  /** Colonnes non associées que l'utilisateur ne veut pas dans les notes. */
  exclues: number[];
};

/** Mots-clés de secours : un en-tête qui contient l'un d'eux est une candidate pour le champ. */
const MOTS_CLES: Record<string, string[]> = {
  famille: ["famille", "domaine", "categorie", "rubrique", "theme", "thematique"],
  libelle: ["controle", "verification", "libelle", "designation", "intitule", "nature", "operation", "prestation"],
  perimetre: ["perimetre", "equipement", "installation", "lieu", "batiment", "zone", "local", "site"],
  caractere: ["caractere", "obligation", "statut reglementaire", "reglementaire"],
  periodicite: ["periodicite", "frequence", "periode", "delai", "intervalle", "cycle"],
  reference: ["reference", "texte", "article", "arrete", "norme", "decret", "code"],
  prestataire: ["prestataire", "fournisseur", "organisme", "societe", "entreprise", "intervenant", "sous traitant"],
  dernier_controle: ["dernier", "derniere", "realise", "realisation", "date controle", "date"],
  resultat: ["resultat", "conclusion", "avis", "etat"],
  code: ["code", "identifiant", "id", "numero", "ref"],
  univers: ["univers", "lot", "corps d etat", "metier"],
  batiment: ["batiment", "site", "immeuble"],
  niveau: ["niveau", "etage"],
  // Pas de « pièce » : « Pièces pour devis » (pièces détachées) n'est pas un local.
  local: ["local", "salle", "chambre"],
  marque: ["marque", "fabricant", "constructeur"],
  modele: ["modele", "type"],
  numero_serie: ["serie"],
  // Pas de mot-clé pour « notes » : une colonne non associée y va déjà, avec son titre (plus clair).
  // Pas de « date » seul : « Date de MP », « Dernière maintenance »… ne sont pas des mises en service.
  mise_en_service: ["mise en service", "installation", "acquisition"],
  statut: ["statut", "etat"],
};

/** Équipements : « Opération à faire » ou « Contrôle » ne désignent pas l'équipement. */
const MOTS_CLES_EQUIPEMENTS: Record<string, string[]> = {
  libelle: ["libelle", "designation", "intitule", "denomination"],
};

/** Le mot-clé figure dans l'en-tête comme mot entier (pluriel en « s » accepté) : « id » ne trouve pas « guide ». */
function contientMot(entete: string, mot: string): boolean {
  return ` ${entete} `.includes(` ${mot} `) || ` ${entete} `.includes(` ${mot}s `);
}

/** Meilleure proposition pour chaque champ : en-tête identique > contenant un mot-clé ; chaque colonne sert une fois. */
function proposer(entetes: string[], type: TypeImport): Correspondance {
  const colonnes = COLONNES[type];
  const norm = entetes.map(normaliser);
  // En-tête répété (« OBSERVATION » sous chaque campagne, « OBSERVATIONS » sous la suivante) : ambigu, aucune
  // proposition ; ces colonnes sont reprises dans les notes avec leur groupe.
  const singulier = norm.map((e) => e.replace(/s\b/g, ""));
  const repetes = new Set(singulier.filter((e, i) => e !== "" && singulier.indexOf(e) !== i));
  const candidats: { cle: string; i: number; score: number }[] = [];
  for (const col of colonnes) {
    const noms = [col.entete, ...(col.alias ?? [])].map(normaliser);
    norm.forEach((e, i) => {
      if (e === "" || repetes.has(singulier[i])) return;
      if (noms.includes(e)) candidats.push({ cle: col.cle, i, score: 100 });
      else {
        const mots = (type === "equipements" ? MOTS_CLES_EQUIPEMENTS[col.cle] : undefined) ?? MOTS_CLES[col.cle] ?? [];
        const idx = mots.findIndex((m) => contientMot(e, m));
        if (idx !== -1) candidats.push({ cle: col.cle, i, score: 50 - idx });
      }
    });
  }
  candidats.sort((a, b) => b.score - a.score);
  const resultat: Correspondance = Object.fromEntries(colonnes.map((c) => [c.cle, null]));
  const prises = new Set<number>();
  for (const c of candidats) {
    if (resultat[c.cle] !== null || prises.has(c.i)) continue;
    resultat[c.cle] = c.i;
    prises.add(c.i);
  }
  return resultat;
}

/** Ligne d'en-têtes : parmi les 10 premières lignes non vides, celle qui reconnaît le plus de colonnes. */
function trouverEntete(tableau: Cellule[][], type: TypeImport): number {
  const vide = (ligne: Cellule[]) => ligne.every((c) => texte(c) === null);
  const candidates = tableau
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => !vide(l))
    .slice(0, 10);
  // 1) Correspondances exactes avec nos intitulés (le modèle) : la ligne qui en reconnaît le plus.
  const noms = new Set(COLONNES[type].flatMap((c) => [c.entete, ...(c.alias ?? [])].map(normaliser)));
  const exact = (l: Cellule[]) => l.filter((c) => noms.has(normaliser(texte(c) ?? ""))).length;
  let meilleure = { i: -1, n: 0 };
  for (const { l, i } of candidates) {
    const n = exact(l);
    if (n > meilleure.n) meilleure = { i, n };
  }
  if (meilleure.i !== -1) return meilleure.i;
  // 2) Sinon : première ligne d'au moins deux cellules remplies (écarte un simple titre de document).
  const remplie = candidates.find(({ l }) => l.filter((c) => texte(c) !== null).length >= 2);
  return remplie ? remplie.i : (candidates[0]?.i ?? -1);
}

/**
 * Titres des colonnes. En-tête sur deux lignes (« MP 2021 » fusionné au-dessus de « Date », « Vigilance »,
 * « Observation ») : le groupe précède le titre et vaut pour les colonnes suivantes jusqu'au groupe d'après,
 * comme une cellule fusionnée. Un texte seul en 1re colonne au-dessus de l'en-tête est un titre de document : ignoré.
 */
function titresColonnes(tableau: Cellule[][], indexEntete: number): string[] {
  const entete = tableau[indexEntete];
  const dessus = indexEntete > 0 ? tableau[indexEntete - 1] : [];
  const groupes = dessus.map((c, i) => ({ i, t: ligne(c) })).filter((g) => g.t !== null && g.i > 0);
  const largeur = Math.max(entete.length, dessus.length);
  let groupe: string | null = null;
  return Array.from({ length: largeur }, (_, i) => {
    const g = groupes.find((x) => x.i === i);
    if (g) groupe = g.t;
    const t = ligne(entete[i]);
    // Le groupe est répété devant chaque colonne : court (« MP 2025/26 : 32 le 16… ») pour ménager les notes.
    return [groupe ? titreCourt(groupe, 20) : null, t ? titreCourt(t) : null].filter(Boolean).join(" · ");
  });
}

export function lireTableau(
  tableau: Cellule[][],
  type: TypeImport,
  correspondance?: Correspondance,
  options: { codeAuto?: boolean; exclues?: number[] } = {},
):
  | { erreur: string; lignes?: never; demande?: DemandeCorrespondance }
  | { erreur?: never; lignes: LigneBrute[]; demande: DemandeCorrespondance } {
  const indexEntete = trouverEntete(tableau, type);
  if (indexEntete === -1) return { erreur: "Le fichier est vide." };

  const colonnes = COLONNES[type];
  const entetes = titresColonnes(tableau, indexEntete);
  // Propositions sur l'en-tête seul : le groupe (« MP 2021 ») ne doit pas faire reconnaître une colonne.
  const choix =
    correspondance ??
    proposer(
      tableau[indexEntete].map((c) => texte(c) ?? ""),
      type,
    );
  const position = new Map<string, number>();
  for (const [cle, i] of Object.entries(choix)) {
    if (i !== null && i >= 0 && i < entetes.length && colonnes.some((c) => c.cle === cle)) position.set(cle, i);
  }
  const exclues = [...new Set(options.exclues ?? [])].filter((i) => i >= 0 && i < entetes.length);
  const demande: DemandeCorrespondance = {
    ligne: indexEntete + 1,
    entetes,
    champs: colonnes.map((c) => ({
      cle: c.cle,
      entete: c.entete,
      obligatoire: Boolean(c.obligatoire),
      aide: c.aide,
      choix: position.get(c.cle) ?? null,
    })),
    exclues,
  };

  // Avec un préfixe de codes générés, la colonne « code » n'est plus obligatoire.
  const manquantes = colonnes.filter(
    (c) => c.obligatoire && !(c.cle === "code" && options.codeAuto) && !position.has(c.cle),
  );
  if (manquantes.length > 0) {
    return { erreur: `Colonne(s) à associer : ${manquantes.map((c) => `« ${c.entete} »`).join(", ")}.`, demande };
  }

  // Colonnes reprises dans les notes (équipements) : ni associées à un champ, ni exclues par l'utilisateur.
  const prises = new Set([...position.values(), ...exclues]);
  const autres =
    type === "equipements"
      ? entetes.map((t, i) => ({ i, titre: t || `Colonne ${i + 1}` })).filter((c) => !prises.has(c.i))
      : [];

  const lignes: LigneBrute[] = [];
  for (let i = indexEntete + 1; i < tableau.length; i++) {
    const remplies = tableau[i].map(ligne).filter((t): t is string => t !== null);
    if (remplies.length === 0) continue;
    const numero = i + 1;
    if (remplies.length === 1) {
      lignes.push({ numero, valeurs: {}, ignoree: { motif: "titre", texte: remplies[0] } });
      continue;
    }
    if (/^(sous )?tota(l|ux)\b/.test(normaliser(remplies[0]))) {
      lignes.push({ numero, valeurs: {}, ignoree: { motif: "total", texte: remplies[0] } });
      continue;
    }
    const valeurs: Record<string, Cellule> = {};
    for (const [cle, p] of position) valeurs[cle] = tableau[i][p] ?? null;
    const notes = autres
      .map((c) => ({ titre: c.titre, valeur: texteNote(tableau[i][c.i]) }))
      .filter((c): c is { titre: string; valeur: string } => c.valeur !== null);
    lignes.push({ numero, valeurs, ...(notes.length ? { autres: notes } : {}) });
  }
  if (!lignes.some((l) => !l.ignoree)) return { erreur: "Aucune ligne de données sous l'en-tête." };
  if (lignes.length > MAX_LIGNES) return { erreur: `Trop de lignes (${lignes.length}) : ${MAX_LIGNES} maximum.` };
  return { lignes, demande };
}

/** Ligne ignorée par la lecture : affichée dans l'aperçu, jamais importée. */
function apercuIgnoree(numero: number, ignoree: NonNullable<LigneBrute["ignoree"]>, suite = ""): LigneApercu {
  const extrait = titreCourt(ignoree.texte);
  return {
    numero,
    statut: "ignoree",
    resume:
      ignoree.motif === "total"
        ? `Ligne de total ignorée (« ${extrait} »)`
        : `Ligne d'une seule cellule ignorée (« ${extrait} »)${suite}`,
    erreurs: [],
  };
}

// --- Existant (lu en base) et résultat -----------------------------------------

export type Existant = {
  familles: { id: string; libelle: string }[];
  prestataires: { id: string; nom: string }[];
  types: { id: string; famille_id: string; libelle: string; caractere: string; periodicite_mois: number }[];
  equipements: { id: string; code: string; numero_serie: string | null }[];
  plans: { type_controle_id: string; equipement_id: string | null; perimetre_libelle: string | null }[];
  localisations: { id: string; batiment: string; niveau: string | null; local: string | null }[];
  univers: { id: string; libelle: string }[];
};

export type StatutLigne = "creation" | "ignoree" | "erreur";
export type LigneApercu = { numero: number; statut: StatutLigne; resume: string; erreurs: string[] };

/** Référence vers un élément existant ({ id }) ou créé par l'import ({ nouveau: clé }). */
export type Ref = { id: string } | { nouveau: string };

export type OperationsControles = {
  familles: string[];
  prestataires: string[];
  types: {
    cle: string;
    famille: Ref;
    libelle: string;
    caractere: string;
    periodicite_mois: number;
    reference_texte: string | null;
  }[];
  plans: {
    numero: number;
    type: Ref;
    equipement_id: string | null;
    perimetre_libelle: string | null;
    prestataire: Ref | null;
    dernier: { date: string; resultat: "conforme" | "avec_reserves" | "non_conforme" } | null;
  }[];
};

export type OperationsEquipements = {
  familles: string[];
  univers: string[];
  localisations: { cle: string; batiment: string; niveau: string | null; local: string | null }[];
  equipements: {
    code: string;
    libelle: string;
    univers: Ref | null;
    famille: Ref | null;
    localisation: Ref | null;
    marque: string | null;
    modele: string | null;
    numero_serie: string | null;
    notes: string | null;
    date_mise_en_service: string | null;
    statut: "en_service" | "hors_service" | "reforme";
  }[];
};

export type Planification<O> = { lignes: LigneApercu[]; operations: O; importable: boolean };

function index<T>(liste: T[], cle: (x: T) => string): Map<string, T> {
  return new Map(liste.map((x) => [cle(x), x]));
}

const MAX_TEXTE = { libelle: 200, perimetre: 200, reference: 500, nom: 200, code: 60, court: 120, niveau: 60 };

function verifierLongueur(valeur: string | null, max: number, nom: string, erreurs: string[]) {
  if (valeur && valeur.length > max) erreurs.push(`${nom} : ${max} caractères maximum`);
}

// --- Planification : contrôles (annexe A) --------------------------------------

export function planifierControles(lignes: LigneBrute[], existant: Existant): Planification<OperationsControles> {
  const aujourdhui = aujourdhuiParis();
  const familles = index(existant.familles, (f) => normaliser(f.libelle));
  const prestataires = index(existant.prestataires, (p) => normaliser(p.nom));
  const equipements = index(existant.equipements, (e) => normaliser(e.code));
  const types = index(existant.types, (t) => `${t.famille_id}|${normaliser(t.libelle)}`);
  const plansExistants = new Set(
    existant.plans.map(
      (p) => `${p.type_controle_id}|${p.equipement_id ?? ""}|${normaliser(p.perimetre_libelle ?? "")}`,
    ),
  );

  const ops: OperationsControles = { familles: [], prestataires: [], types: [], plans: [] };
  const nouvellesFamilles = new Map<string, string>();
  const nouveauxPrestataires = new Map<string, string>();
  const nouveauxTypes = new Map<string, OperationsControles["types"][number]>();
  const vusDansFichier = new Set<string>();
  const apercu: LigneApercu[] = [];

  for (const { numero, valeurs: v, ignoree } of lignes) {
    if (ignoree) {
      apercu.push(apercuIgnoree(numero, ignoree));
      continue;
    }
    const erreurs: string[] = [];
    const famille = texte(v.famille);
    const libelle = texte(v.libelle);
    const perimetre = texte(v.perimetre);
    const reference = texte(v.reference);
    const prestataire = texte(v.prestataire);
    const caractere = lireEnum(v.caractere, CARACTERES);
    const periodiciteBrute = texte(v.periodicite);
    const periodicite = lirePeriodicite(periodiciteBrute);
    const dernier = lireDate(v.dernier_controle);
    const resultat = lireEnum(v.resultat, RESULTATS);

    if (!famille) erreurs.push("Famille manquante");
    if (!libelle) erreurs.push("Libellé du contrôle manquant");
    if (!perimetre) erreurs.push("Périmètre / équipement manquant");
    if (caractere === null) erreurs.push("Caractère manquant");
    if (caractere === undefined)
      erreurs.push(`Caractère « ${texte(v.caractere)} » inconnu (réglementaire, obligatoire, interne)`);
    if (!(periodicite >= 1 && periodicite <= 120)) {
      erreurs.push(`Périodicité « ${periodiciteBrute ?? ""} » invalide (entier de 1 à 120 mois)`);
    }
    verifierLongueur(famille, MAX_TEXTE.court, "Famille", erreurs);
    verifierLongueur(libelle, MAX_TEXTE.libelle, "Libellé", erreurs);
    verifierLongueur(perimetre, MAX_TEXTE.perimetre, "Périmètre", erreurs);
    verifierLongueur(reference, MAX_TEXTE.reference, "Référence", erreurs);
    verifierLongueur(prestataire, MAX_TEXTE.nom, "Prestataire", erreurs);
    if (dernier.erreur) erreurs.push(`Date du dernier contrôle : ${dernier.erreur}`);
    if (dernier.valeur && dernier.valeur > aujourdhui) erreurs.push("Date du dernier contrôle dans le futur");
    if (dernier.valeur && !resultat) {
      erreurs.push(
        resultat === undefined
          ? `Résultat « ${texte(v.resultat)} » inconnu (conforme, avec réserves, non conforme)`
          : "Résultat du dernier contrôle manquant (obligatoire avec une date)",
      );
    }
    if (!dernier.valeur && texte(v.resultat)) erreurs.push("Résultat donné sans date du dernier contrôle");

    if (erreurs.length > 0 || !famille || !libelle || !perimetre || !caractere) {
      apercu.push({ numero, statut: "erreur", resume: libelle ?? "", erreurs });
      continue;
    }

    // Famille
    const cleFamille = normaliser(famille);
    let refFamille: Ref;
    const familleExistante = familles.get(cleFamille);
    if (familleExistante) refFamille = { id: familleExistante.id };
    else {
      if (!nouvellesFamilles.has(cleFamille)) {
        nouvellesFamilles.set(cleFamille, famille);
        ops.familles.push(famille);
      }
      refFamille = { nouveau: nouvellesFamilles.get(cleFamille)! };
    }

    // Type : jamais de modification silencieuse d'un type existant
    let refType: Ref;
    const typeExistant = "id" in refFamille ? types.get(`${refFamille.id}|${normaliser(libelle)}`) : undefined;
    const cleType = `${cleFamille}|${normaliser(libelle)}`;
    if (typeExistant) {
      if (typeExistant.periodicite_mois !== periodicite || typeExistant.caractere !== caractere) {
        erreurs.push(
          `Ce type existe déjà avec une périodicité de ${typeExistant.periodicite_mois} mois (${typeExistant.caractere}) : modifiez-le dans l'application ou alignez le fichier`,
        );
      }
      refType = { id: typeExistant.id };
    } else {
      const deja = nouveauxTypes.get(cleType);
      if (deja && (deja.periodicite_mois !== periodicite || deja.caractere !== caractere)) {
        erreurs.push(`Périodicité ou caractère différent d'une ligne précédente pour le même contrôle`);
      } else if (!deja) {
        const nouveau = {
          cle: cleType,
          famille: refFamille,
          libelle,
          caractere,
          periodicite_mois: periodicite,
          reference_texte: reference,
        };
        nouveauxTypes.set(cleType, nouveau);
        ops.types.push(nouveau);
      }
      refType = { nouveau: cleType };
    }

    // Périmètre : code d'équipement existant, sinon texte libre
    const equipement = equipements.get(normaliser(perimetre));
    const equipementId = equipement?.id ?? null;
    const perimetreLibelle = equipement ? null : perimetre;

    const cleFichier = `${cleType}|${equipementId ?? ""}|${normaliser(perimetreLibelle ?? "")}`;
    if (vusDansFichier.has(cleFichier))
      erreurs.push("Doublon : même contrôle et même périmètre qu'une ligne précédente");
    vusDansFichier.add(cleFichier);

    if (erreurs.length > 0) {
      apercu.push({ numero, statut: "erreur", resume: libelle, erreurs });
      continue;
    }

    if (
      "id" in refType &&
      plansExistants.has(`${refType.id}|${equipementId ?? ""}|${normaliser(perimetreLibelle ?? "")}`)
    ) {
      apercu.push({ numero, statut: "ignoree", resume: `${libelle} — ${perimetre} : déjà présent`, erreurs: [] });
      continue;
    }

    // Prestataire
    let refPrestataire: Ref | null = null;
    if (prestataire) {
      const clePrestataire = normaliser(prestataire);
      const existantP = prestataires.get(clePrestataire);
      if (existantP) refPrestataire = { id: existantP.id };
      else {
        if (!nouveauxPrestataires.has(clePrestataire)) {
          nouveauxPrestataires.set(clePrestataire, prestataire);
          ops.prestataires.push(prestataire);
        }
        refPrestataire = { nouveau: nouveauxPrestataires.get(clePrestataire)! };
      }
    }

    ops.plans.push({
      numero,
      type: refType,
      equipement_id: equipementId,
      perimetre_libelle: perimetreLibelle,
      prestataire: refPrestataire,
      dernier: dernier.valeur && resultat ? { date: dernier.valeur, resultat } : null,
    });
    const details = [
      equipement ? `équipement ${equipement.code}` : perimetre,
      `${periodicite} mois`,
      dernier.valeur ? `dernier contrôle le ${dernier.valeur.split("-").reverse().join("/")}` : "jamais contrôlé",
    ];
    apercu.push({ numero, statut: "creation", resume: `${libelle} — ${details.join(" · ")}`, erreurs: [] });
  }

  return {
    lignes: apercu,
    operations: ops,
    importable: apercu.every((l) => l.statut !== "erreur") && ops.plans.length > 0,
  };
}

// --- Planification : équipements ------------------------------------------------

export type OptionsEquipements = {
  /** Identifiant d'un univers existant, appliqué aux lignes dont la colonne « univers » est vide ou absente. */
  universParDefaut?: string | null;
  /** Préfixe des codes générés pour les lignes sans code (ex. « FR- » → FR-001, FR-002…). */
  prefixeCode?: string | null;
  /** Bâtiment des lignes dont la colonne « bâtiment » est vide ou absente. */
  batimentParDefaut?: string | null;
  /** Les lignes d'une seule cellule (« AUTOTENSIOMETRE ») donnent la famille des lignes qui suivent. */
  titresFamille?: boolean;
};

const MOTIFS_CODE = { absent: "non repris", invalide: "non valide", double: "en double" } as const;

/** Préfixe de code valide : 1 à 20 caractères, sans espace ni / \ ? #. */
export const PREFIXE_CODE_VALIDE = /^[^\s/\\?#]{1,20}$/;

export function planifierEquipements(
  lignes: LigneBrute[],
  existant: Existant,
  options: OptionsEquipements = {},
): Planification<OperationsEquipements> {
  const aujourdhui = aujourdhuiParis();
  const codes = new Set(existant.equipements.map((e) => normaliser(e.code)));
  const cleLoc = (b: string, n: string | null, l: string | null) => [b, n ?? "", l ?? ""].map(normaliser).join("|");
  const localisations = index(existant.localisations, (l) => cleLoc(l.batiment, l.niveau, l.local));

  const ops: OperationsEquipements = { familles: [], univers: [], localisations: [], equipements: [] };
  /** Référentiel désigné par son libellé : existant (id) ou créé une seule fois par l'import. */
  const referentiel = (existants: { id: string; libelle: string }[], creations: string[]) => {
    const parCle = index(existants, (x) => normaliser(x.libelle));
    const nouveaux = new Map<string, string>();
    return (libelle: string | null): Ref | null => {
      if (!libelle) return null;
      const cle = normaliser(libelle);
      const trouve = parCle.get(cle);
      if (trouve) return { id: trouve.id };
      if (!nouveaux.has(cle)) {
        nouveaux.set(cle, libelle);
        creations.push(libelle);
      }
      return { nouveau: nouveaux.get(cle)! };
    };
  };
  const refFamille = referentiel(existant.familles, ops.familles);
  const refUnivers = referentiel(existant.univers, ops.univers);
  const nouvellesLocs = new Set<string>();
  const codesFichier = new Set<string>();
  const apercu: LigneApercu[] = [];

  // Codes générés : numérotation continue en sautant les codes déjà pris (existants ou écrits dans le fichier).
  const prefixe = options.prefixeCode && PREFIXE_CODE_VALIDE.test(options.prefixeCode) ? options.prefixeCode : null;
  const reserves = new Set([...codes, ...lignes.map((l) => normaliser(texte(l.valeurs.code) ?? ""))]);
  let compteur = 0;
  const prochainCode = (): string => {
    let c: string;
    do {
      compteur++;
      c = `${prefixe}${String(compteur).padStart(3, "0")}`;
    } while (reserves.has(normaliser(c)));
    reserves.add(normaliser(c));
    return c;
  };
  // Avec des codes générés, un relevé du même fichier ne doit pas créer de doublons : le n° de série fait foi.
  const seriesExistantes = new Set(existant.equipements.map((e) => normaliser(e.numero_serie ?? "")).filter(Boolean));
  const seriesFichier = new Map<string, number>();
  const batimentParDefaut = options.batimentParDefaut?.trim() || null;
  let familleDeSection: string | null = null;

  for (const { numero, valeurs: v, autres, ignoree } of lignes) {
    if (ignoree) {
      const titreFamille = options.titresFamille && ignoree.motif === "titre";
      if (titreFamille) familleDeSection = ignoree.texte.slice(0, MAX_TEXTE.court);
      apercu.push(apercuIgnoree(numero, ignoree, titreFamille ? ` : famille des lignes suivantes` : ""));
      continue;
    }
    const erreurs: string[] = [];
    /** Informations sans champ dédié, ajoutées en tête des notes (rien n'est perdu ni inventé). */
    const precisions: string[] = [];

    // Code : un code absent (« ABSENT »), non valide (« ANCIEN N°157 ? ») ou en double est remplacé par un code
    // généré quand un préfixe est donné ; la valeur d'origine est gardée dans les notes.
    const codeBrut = ligne(v.code);
    let motifCode: keyof typeof MOTIFS_CODE | null = null;
    if (codeBrut !== null) {
      if (valeurAbsente(codeBrut)) motifCode = "absent";
      else if (!/^[^\s/\\?#]+$/.test(codeBrut) || codeBrut.length > MAX_TEXTE.code) motifCode = "invalide";
      else if (codesFichier.has(normaliser(codeBrut))) motifCode = "double";
    }
    const codeAuto = prefixe !== null && (codeBrut === null || motifCode !== null);
    const code = codeAuto || motifCode === "absent" ? null : codeBrut;
    if (codeAuto && codeBrut !== null) precisions.push(`Code d'origine : ${codeBrut}`);

    // N° de série : 1re ligne de la cellule ; les lignes suivantes (« PAS DE DEVIS… ») vont dans les notes.
    const [serieBrute, ...suiteSerie] = (texteNote(v.numero_serie) ?? "").split("\n");
    let serie = serieBrute.trim() || null;
    if (serie && valeurAbsente(serie)) {
      precisions.push(`N° de série : ${serie}`);
      serie = null;
    }
    const suite = suiteSerie.map((s) => s.trim()).filter(Boolean);
    if (suite.length) precisions.push(`N° de série (suite) : ${suite.join(" / ")}`);

    const marque = ligne(v.marque);
    const modele = ligne(v.modele);
    // Rien pour identifier un équipement (suite d'une cellule qui déborde, ligne « En service » isolée) : ignorée.
    if (!codeBrut && !ligne(v.libelle) && !marque && !modele && !serieBrute.trim()) {
      apercu.push({
        numero,
        statut: "ignoree",
        resume: "Ligne ignorée : ni code, ni libellé, ni marque, ni modèle, ni n° de série",
        erreurs: [],
      });
      continue;
    }
    const famille = ligne(v.famille) ?? (options.titresFamille ? familleDeSection : null);
    const libelle = ligne(v.libelle) ?? ([marque, modele].filter(Boolean).join(" ") || famille);
    const univers = ligne(v.univers);
    const batiment = ligne(v.batiment) ?? batimentParDefaut;
    const niveau = ligne(v.niveau);
    const local = ligne(v.local);

    const annee = lireAnnee(v.mise_en_service);
    const miseEnService = annee === null ? lireDate(v.mise_en_service) : { valeur: null };
    if (annee !== null) precisions.push(`Mise en service : ${annee}`);

    let statut = lireEnum(v.statut, STATUTS);
    if (statut === undefined) {
      const proche = lireEnum(v.statut, STATUTS_PROCHES);
      if (proche) {
        statut = proche;
        precisions.push(`Statut d'origine : ${ligne(v.statut)}`);
      }
    }

    const notes = [...precisions, texteNote(v.notes), ...(autres ?? []).map((a) => `${a.titre} : ${a.valeur}`)]
      .filter(Boolean)
      .join("\n");
    if (!code && !codeAuto) {
      erreurs.push(
        motifCode === "absent"
          ? `Code manquant (« ${codeBrut} ») : indiquez un préfixe pour générer les codes`
          : "Code manquant",
      );
    }
    if (!libelle) erreurs.push("Libellé manquant (ni libellé, ni marque, ni modèle, ni famille)");
    if (notes.length > 2000) {
      erreurs.push(
        `Notes : ${notes.length} caractères pour 2 000 au maximum. Décochez des colonnes reprises dans les notes (« Ajuster l'association des colonnes »)`,
      );
    }
    // Même règle que la saisie (schemaEquipement) : le code sert dans les adresses et les étiquettes.
    if (code && motifCode === "invalide") {
      erreurs.push(
        /^[^\s/\\?#]+$/.test(code) ? `Code : ${MAX_TEXTE.code} caractères maximum` : "Code : sans espace ni / \\ ? #",
      );
    }
    verifierLongueur(libelle, MAX_TEXTE.libelle, "Libellé", erreurs);
    verifierLongueur(univers, MAX_TEXTE.court, "Univers", erreurs);
    verifierLongueur(famille, MAX_TEXTE.court, "Famille", erreurs);
    verifierLongueur(batiment, MAX_TEXTE.court, "Bâtiment", erreurs);
    verifierLongueur(niveau, MAX_TEXTE.niveau, "Niveau", erreurs);
    verifierLongueur(local, MAX_TEXTE.court, "Local", erreurs);
    verifierLongueur(marque, MAX_TEXTE.court, "Marque", erreurs);
    verifierLongueur(modele, MAX_TEXTE.court, "Modèle", erreurs);
    verifierLongueur(serie, MAX_TEXTE.court, "N° de série", erreurs);
    if (!batiment && (niveau || local)) {
      erreurs.push("Bâtiment obligatoire si niveau ou local est rempli (colonne ou bâtiment par défaut)");
    }
    if (miseEnService.erreur) erreurs.push(`Mise en service : ${miseEnService.erreur}`);
    if (miseEnService.valeur && miseEnService.valeur > aujourdhui) erreurs.push("Mise en service dans le futur");
    if (annee !== null && annee > Number(aujourdhui.slice(0, 4))) erreurs.push("Mise en service dans le futur");
    if (statut === undefined) {
      erreurs.push(`Statut « ${ligne(v.statut)} » inconnu (en service, hors service, réformé, en maintenance)`);
    }
    if (code && motifCode === "double") erreurs.push(`Code « ${code} » en double dans le fichier`);
    if (code) codesFichier.add(normaliser(code));

    if (erreurs.length > 0 || (!code && !codeAuto) || !libelle) {
      apercu.push({ numero, statut: "erreur", resume: [code, libelle].filter(Boolean).join(" — "), erreurs });
      continue;
    }
    // Même n° de série deux fois (relevé fait deux fois, doublon signalé) : un seul équipement.
    const ligneSerie = codeAuto && serie ? seriesFichier.get(normaliser(serie)) : undefined;
    if (ligneSerie !== undefined) {
      apercu.push({
        numero,
        statut: "ignoree",
        resume: `${libelle} : n° de série ${serie} déjà repris à la ligne ${ligneSerie}`,
        erreurs: [],
      });
      continue;
    }
    if (serie && !seriesFichier.has(normaliser(serie))) seriesFichier.set(normaliser(serie), numero);
    if (code && codes.has(normaliser(code))) {
      apercu.push({ numero, statut: "ignoree", resume: `${code} — ${libelle} : code déjà présent`, erreurs: [] });
      continue;
    }
    if (codeAuto && serie && seriesExistantes.has(normaliser(serie))) {
      apercu.push({
        numero,
        statut: "ignoree",
        resume: `${libelle} : n° de série ${serie} déjà présent`,
        erreurs: [],
      });
      continue;
    }
    const codeFinal = code ?? prochainCode();

    let refLoc: Ref | null = null;
    if (batiment) {
      const cle = cleLoc(batiment, niveau, local);
      const l = localisations.get(cle);
      if (l) refLoc = { id: l.id };
      else {
        if (!nouvellesLocs.has(cle)) {
          nouvellesLocs.add(cle);
          ops.localisations.push({ cle, batiment, niveau, local });
        }
        refLoc = { nouveau: cle };
      }
    }

    ops.equipements.push({
      code: codeFinal,
      libelle,
      univers: univers || !options.universParDefaut ? refUnivers(univers) : { id: options.universParDefaut },
      famille: refFamille(famille),
      localisation: refLoc,
      marque,
      modele,
      numero_serie: serie,
      notes: notes || null,
      date_mise_en_service: miseEnService.valeur,
      statut: statut ?? "en_service",
    });
    const genere = codeAuto ? ` (code généré${motifCode ? `, « ${codeBrut} » ${MOTIFS_CODE[motifCode]}` : ""})` : "";
    apercu.push({
      numero,
      statut: "creation",
      resume: [
        `${codeFinal}${genere} — ${libelle}`,
        famille,
        univers,
        [batiment, niveau, local].filter(Boolean).join(" / "),
      ]
        .filter(Boolean)
        .join(" · "),
      erreurs: [],
    });
  }

  return {
    lignes: apercu,
    operations: ops,
    importable: apercu.every((l) => l.statut !== "erreur") && ops.equipements.length > 0,
  };
}
