// Lecture d'un fichier importé (xlsx ou csv) en tableau de cellules, et génération du modèle.

import Papa from "papaparse";
import readXlsxFile from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { AIDE_AUTRES_COLONNES, COLONNES, type Cellule, type TypeImport } from "@/lib/metier/import";

export const TAILLE_MAX = 5 * 1024 * 1024;

/** Feuille d'aide du modèle téléchargeable : jamais proposée à l'import. */
const FEUILLE_AIDE = "Mode d'emploi";

const SIGNATURE_ZIP = [0x50, 0x4b, 0x03, 0x04];

export type LectureFichier = { tableau?: Cellule[][]; erreur?: string; feuilles?: string[] };

/**
 * Lit un classeur (.xlsx, .xlsm) ou un CSV. Un classeur à plusieurs feuilles non vides exige le choix d'une feuille :
 * on renvoie alors leurs noms (feuilles) au lieu de deviner.
 */
export async function lireFichier(nom: string, contenu: Buffer, feuille?: string): Promise<LectureFichier> {
  if (contenu.length === 0) return { erreur: "Fichier vide." };
  if (contenu.length > TAILLE_MAX) return { erreur: "Fichier trop volumineux (5 Mo maximum)." };
  const extension = nom.toLowerCase().split(".").pop();

  if (extension === "xlsx" || extension === "xlsm") {
    // Vérifie la signature réelle du fichier, pas seulement son extension.
    if (!SIGNATURE_ZIP.every((o, i) => contenu[i] === o))
      return { erreur: "Ce fichier n'est pas un classeur Excel valide." };
    try {
      const feuilles = (await readXlsxFile(contenu)) as { sheet: string; data: Cellule[][] }[];
      const remplies = feuilles
        .filter((f) => f.sheet !== FEUILLE_AIDE)
        .filter((f) => f.data.some((l) => l.some((c) => c !== null && c !== "")));
      const choisie = feuille
        ? feuilles.find((f) => f.sheet === feuille)
        : remplies.length === 1
          ? remplies[0]
          : undefined;
      if (feuille && !choisie) return { erreur: "Feuille introuvable dans ce classeur." };
      if (!choisie) {
        return remplies.length === 0
          ? { erreur: "Le classeur est vide." }
          : {
              erreur: "Ce classeur contient plusieurs feuilles : choisissez celle à importer.",
              feuilles: remplies.map((f) => f.sheet),
            };
      }
      return { tableau: choisie.data };
    } catch {
      return { erreur: "Classeur Excel illisible. Enregistrez-le à nouveau au format .xlsx." };
    }
  }

  if (extension === "csv") {
    const texte = contenu.toString("utf8").replace(/^﻿/, "");
    if (texte.includes("�")) {
      return { erreur: "Encodage non reconnu : enregistrez le CSV en « UTF-8 » (Excel : CSV UTF-8)." };
    }
    const resultat = Papa.parse<string[]>(texte, { delimiter: "", skipEmptyLines: false });
    if (resultat.errors.some((e) => e.type === "Quotes")) return { erreur: "CSV mal formé (guillemets non fermés)." };
    return { tableau: resultat.data };
  }

  if (extension === "xls") {
    return {
      erreur:
        "Les anciens classeurs .xls ne sont pas lus. Dans Excel : Fichier → Enregistrer sous → « Classeur Excel (.xlsx) » (ou « CSV UTF-8 »), puis réimportez.",
    };
  }
  return { erreur: "Format non pris en charge : utilisez .xlsx, .xlsm ou .csv." };
}

/** Modèle Excel : en-têtes sur la 1re feuille, mode d'emploi sur la 2e. */
export async function genererModele(type: TypeImport): Promise<Buffer> {
  const colonnes = COLONNES[type];
  const entetes = colonnes.map((c) => ({ value: c.entete, fontWeight: "bold" as const }));
  const aide = [
    [
      { value: "Colonne", fontWeight: "bold" as const },
      { value: "Obligatoire", fontWeight: "bold" as const },
      { value: "Contenu attendu", fontWeight: "bold" as const },
    ],
    ...colonnes.map((c) => [{ value: c.entete }, { value: c.obligatoire ? "oui" : "non" }, { value: c.aide }]),
    [],
    ...(type === "equipements" ? [[{ value: AIDE_AUTRES_COLONNES }]] : []),
    [{ value: "Aucune donnée patient dans ce fichier." }],
  ];
  return writeXlsxFile([
    {
      data: [entetes],
      sheet: type === "controles" ? "Contrôles" : "Équipements",
      columns: colonnes.map(() => ({ width: 28 })),
    },
    { data: aide, sheet: FEUILLE_AIDE, columns: [{ width: 30 }, { width: 12 }, { width: 80 }] },
  ]).toBuffer();
}
