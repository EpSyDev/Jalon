// Lecture d'un fichier importé (xlsx ou csv) en tableau de cellules, et génération du modèle.

import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { COLONNES, type Cellule, type TypeImport } from "@/lib/metier/import";

export const TAILLE_MAX = 5 * 1024 * 1024;

const SIGNATURE_ZIP = [0x50, 0x4b, 0x03, 0x04];

export async function lireFichier(nom: string, contenu: Buffer): Promise<{ tableau?: Cellule[][]; erreur?: string }> {
  if (contenu.length === 0) return { erreur: "Fichier vide." };
  if (contenu.length > TAILLE_MAX) return { erreur: "Fichier trop volumineux (5 Mo maximum)." };
  const extension = nom.toLowerCase().split(".").pop();

  if (extension === "xlsx") {
    // Vérifie la signature réelle du fichier, pas seulement son extension.
    if (!SIGNATURE_ZIP.every((o, i) => contenu[i] === o))
      return { erreur: "Ce fichier n'est pas un classeur Excel valide." };
    try {
      return { tableau: (await readSheet(contenu)) as Cellule[][] };
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

  return { erreur: "Format non pris en charge : utilisez .xlsx ou .csv." };
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
    [{ value: "Aucune donnée patient dans ce fichier." }],
  ];
  return writeXlsxFile([
    {
      data: [entetes],
      sheet: type === "controles" ? "Contrôles" : "Équipements",
      columns: colonnes.map(() => ({ width: 28 })),
    },
    { data: aide, sheet: "Mode d'emploi", columns: [{ width: 30 }, { width: 12 }, { width: 80 }] },
  ]).toBuffer();
}
