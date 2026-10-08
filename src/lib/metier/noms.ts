// Masquage des noms de personnes dans les textes importés (fichiers Excel, rapports PDF) : seule l'initiale reste
// (« Dr ROGER » → « Dr R. », « IPA Edwige GUERIN » → « IPA E. G. »). Repérage par le titre qui précède le nom :
// un nom écrit seul (« GUERIN ») ne se distingue pas d'un nom de service ou de marque et reste tel quel.

const TITRES = [
  "Docteur",
  "Dr",
  "Professeur",
  "Pr",
  "Monsieur",
  "Madame",
  "Mademoiselle",
  "M.",
  "Mr",
  "Mme",
  "Mlle",
  "IPA",
  "IDE",
  "IDEC",
  "ASH",
  "Infirmier",
  "Infirmière",
  "Cadre",
];

const echapper = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Titre (tel quel ou en capitales, point final facultatif), puis 1 à 3 mots commençant par une majuscule.
const TITRE = TITRES.flatMap((t) => [t, t.toUpperCase()])
  .map(echapper)
  .join("|");
const MOT = "\\p{Lu}[\\p{L}'’-]*";
const MOTIF = new RegExp(`(?<![\\p{L}])(${TITRE})(\\.?)(\\s+)(${MOT}(?:\\s+${MOT}){0,2})(?![\\p{L}])`, "gu");

export function masquerNoms(texte: string): string {
  return texte.replace(MOTIF, (_, titre: string, point: string, espace: string, nom: string) => {
    const initiales = nom
      .split(/\s+/)
      .map((mot) => `${mot[0]}.`)
      .join(" ");
    return `${titre}${point}${espace}${initiales}`;
  });
}
