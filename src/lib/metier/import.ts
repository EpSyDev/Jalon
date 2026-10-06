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
    { cle: "code", entete: "Code", obligatoire: true, aide: "Identifiant unique et lisible (ex. : TGBT-A)." },
    { cle: "libelle", entete: "Libellé", obligatoire: true, aide: "Désignation de l'équipement." },
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
  ],
};

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

// --- Lecture du tableau --------------------------------------------------------

export type LigneBrute = { numero: number; valeurs: Record<string, Cellule> };

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
  entetes: string[];
  champs: { cle: string; entete: string; obligatoire: boolean; aide: string; choix: number | null }[];
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
  code: ["code", "numero", "identifiant", "ref", "id"],
  batiment: ["batiment", "site", "immeuble"],
  niveau: ["niveau", "etage"],
  local: ["local", "piece", "salle"],
  marque: ["marque", "fabricant", "constructeur"],
  modele: ["modele", "type"],
  numero_serie: ["serie"],
  mise_en_service: ["mise en service", "installation", "date"],
  statut: ["statut", "etat"],
};

/** Meilleure proposition pour chaque champ : en-tête identique > contenant un mot-clé ; chaque colonne sert une fois. */
function proposer(entetes: string[], type: TypeImport): Correspondance {
  const colonnes = COLONNES[type];
  const norm = entetes.map(normaliser);
  const candidats: { cle: string; i: number; score: number }[] = [];
  for (const col of colonnes) {
    const noms = [col.entete, ...(col.alias ?? [])].map(normaliser);
    norm.forEach((e, i) => {
      if (e === "") return;
      if (noms.includes(e)) candidats.push({ cle: col.cle, i, score: 100 });
      else {
        const mots = MOTS_CLES[col.cle] ?? [];
        const idx = mots.findIndex((m) => e.includes(m));
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

export function lireTableau(
  tableau: Cellule[][],
  type: TypeImport,
  correspondance?: Correspondance,
):
  | { erreur: string; lignes?: never; demande?: DemandeCorrespondance }
  | { erreur?: never; lignes: LigneBrute[]; demande?: never } {
  const vide = (ligne: Cellule[]) => ligne.every((c) => texte(c) === null);
  const indexEntete = trouverEntete(tableau, type);
  if (indexEntete === -1) return { erreur: "Le fichier est vide." };

  const colonnes = COLONNES[type];
  const entetes = tableau[indexEntete].map((c) => texte(c) ?? "");
  const choix = correspondance ?? proposer(entetes, type);
  const position = new Map<string, number>();
  for (const [cle, i] of Object.entries(choix)) {
    if (i !== null && i >= 0 && i < entetes.length) position.set(cle, i);
  }

  const manquantes = colonnes.filter((c) => c.obligatoire && !position.has(c.cle));
  if (manquantes.length > 0) {
    return {
      erreur: `Colonne(s) à associer : ${manquantes.map((c) => `« ${c.entete} »`).join(", ")}.`,
      demande: {
        ligne: indexEntete + 1,
        entetes,
        champs: colonnes.map((c) => ({
          cle: c.cle,
          entete: c.entete,
          obligatoire: Boolean(c.obligatoire),
          aide: c.aide,
          choix: choix[c.cle] ?? null,
        })),
      },
    };
  }

  const lignes: LigneBrute[] = [];
  for (let i = indexEntete + 1; i < tableau.length; i++) {
    if (vide(tableau[i])) continue;
    const valeurs: Record<string, Cellule> = {};
    for (const [cle, p] of position) valeurs[cle] = tableau[i][p] ?? null;
    lignes.push({ numero: i + 1, valeurs });
  }
  if (lignes.length === 0) return { erreur: "Aucune ligne de données sous l'en-tête." };
  if (lignes.length > MAX_LIGNES) return { erreur: `Trop de lignes (${lignes.length}) : ${MAX_LIGNES} maximum.` };
  return { lignes };
}

// --- Existant (lu en base) et résultat -----------------------------------------

export type Existant = {
  familles: { id: string; libelle: string }[];
  prestataires: { id: string; nom: string }[];
  types: { id: string; famille_id: string; libelle: string; caractere: string; periodicite_mois: number }[];
  equipements: { id: string; code: string }[];
  plans: { type_controle_id: string; equipement_id: string | null; perimetre_libelle: string | null }[];
  localisations: { id: string; batiment: string; niveau: string | null; local: string | null }[];
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
  localisations: { cle: string; batiment: string; niveau: string | null; local: string | null }[];
  equipements: {
    code: string;
    libelle: string;
    famille: Ref | null;
    localisation: Ref | null;
    marque: string | null;
    modele: string | null;
    numero_serie: string | null;
    date_mise_en_service: string | null;
    statut: "en_service" | "hors_service" | "reforme";
  }[];
};

export type Planification<O> = { lignes: LigneApercu[]; operations: O; importable: boolean };

function index<T>(liste: T[], cle: (x: T) => string): Map<string, T> {
  return new Map(liste.map((x) => [cle(x), x]));
}

const MAX_TEXTE = { libelle: 200, perimetre: 200, reference: 500, nom: 200, code: 60, court: 120 };

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

  for (const { numero, valeurs: v } of lignes) {
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

export function planifierEquipements(lignes: LigneBrute[], existant: Existant): Planification<OperationsEquipements> {
  const aujourdhui = aujourdhuiParis();
  const familles = index(existant.familles, (f) => normaliser(f.libelle));
  const codes = new Set(existant.equipements.map((e) => normaliser(e.code)));
  const cleLoc = (b: string, n: string | null, l: string | null) => [b, n ?? "", l ?? ""].map(normaliser).join("|");
  const localisations = index(existant.localisations, (l) => cleLoc(l.batiment, l.niveau, l.local));

  const ops: OperationsEquipements = { familles: [], localisations: [], equipements: [] };
  const nouvellesFamilles = new Map<string, string>();
  const nouvellesLocs = new Set<string>();
  const codesFichier = new Set<string>();
  const apercu: LigneApercu[] = [];

  for (const { numero, valeurs: v } of lignes) {
    const erreurs: string[] = [];
    const code = texte(v.code);
    const libelle = texte(v.libelle);
    const famille = texte(v.famille);
    const batiment = texte(v.batiment);
    const niveau = texte(v.niveau);
    const local = texte(v.local);
    const miseEnService = lireDate(v.mise_en_service);
    const statut = lireEnum(v.statut, STATUTS);

    if (!code) erreurs.push("Code manquant");
    if (!libelle) erreurs.push("Libellé manquant");
    verifierLongueur(code, MAX_TEXTE.code, "Code", erreurs);
    verifierLongueur(libelle, MAX_TEXTE.libelle, "Libellé", erreurs);
    verifierLongueur(famille, MAX_TEXTE.court, "Famille", erreurs);
    verifierLongueur(batiment, MAX_TEXTE.court, "Bâtiment", erreurs);
    if (!batiment && (niveau || local)) erreurs.push("Bâtiment obligatoire si niveau ou local est rempli");
    if (miseEnService.erreur) erreurs.push(`Mise en service : ${miseEnService.erreur}`);
    if (miseEnService.valeur && miseEnService.valeur > aujourdhui) erreurs.push("Mise en service dans le futur");
    if (statut === undefined) erreurs.push(`Statut « ${texte(v.statut)} » inconnu (en service, hors service, réformé)`);
    if (code && codesFichier.has(normaliser(code))) erreurs.push(`Code « ${code} » en double dans le fichier`);
    if (code) codesFichier.add(normaliser(code));

    if (erreurs.length > 0 || !code || !libelle) {
      apercu.push({ numero, statut: "erreur", resume: [code, libelle].filter(Boolean).join(" — "), erreurs });
      continue;
    }
    if (codes.has(normaliser(code))) {
      apercu.push({ numero, statut: "ignoree", resume: `${code} — ${libelle} : code déjà présent`, erreurs: [] });
      continue;
    }

    let refFamille: Ref | null = null;
    if (famille) {
      const cle = normaliser(famille);
      const f = familles.get(cle);
      if (f) refFamille = { id: f.id };
      else {
        if (!nouvellesFamilles.has(cle)) {
          nouvellesFamilles.set(cle, famille);
          ops.familles.push(famille);
        }
        refFamille = { nouveau: nouvellesFamilles.get(cle)! };
      }
    }

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
      code,
      libelle,
      famille: refFamille,
      localisation: refLoc,
      marque: texte(v.marque),
      modele: texte(v.modele),
      numero_serie: texte(v.numero_serie),
      date_mise_en_service: miseEnService.valeur,
      statut: statut ?? "en_service",
    });
    apercu.push({
      numero,
      statut: "creation",
      resume: [`${code} — ${libelle}`, [batiment, niveau, local].filter(Boolean).join(" / ")]
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
