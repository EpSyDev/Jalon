// Export Excel des listes (plan de repli papier/Excel, partage avec la direction). Une feuille, en-têtes en gras,
// dates en vraies dates Excel (JJ/MM/AAAA), jamais de formule.

import writeXlsxFile from "write-excel-file/node";
import type { Cell } from "write-excel-file/node";

export type ColonneExport = { entete: string; type?: "texte" | "date" | "nombre"; largeur?: number };
export type ValeurExport = string | number | null;

/** « 2026-10-07 » → date Excel à minuit UTC (aucun décalage de fuseau à la relecture). */
function dateExcel(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function cellule(valeur: ValeurExport, type: ColonneExport["type"]): Cell {
  if (valeur === null || valeur === "") return null;
  if (type === "date" && typeof valeur === "string")
    return { value: dateExcel(valeur), type: Date, format: "dd/mm/yyyy" };
  if (type === "nombre") return { value: Number(valeur), type: Number };
  // Texte forcé : une saisie commençant par « = » reste du texte, jamais une formule.
  return { value: String(valeur), type: String };
}

export async function genererTableur(
  feuille: string,
  colonnes: ColonneExport[],
  lignes: ValeurExport[][],
): Promise<Buffer> {
  const entetes = colonnes.map((c) => ({ value: c.entete, fontWeight: "bold" as const }));
  const data = [entetes, ...lignes.map((l) => l.map((v, i) => cellule(v, colonnes[i]?.type)))];
  return writeXlsxFile([
    { data, sheet: feuille.slice(0, 31), columns: colonnes.map((c) => ({ width: c.largeur ?? 18 })) },
  ]).toBuffer();
}

/** Réponse de téléchargement d'un classeur. */
export function reponseTableur(contenu: Buffer, nom: string): Response {
  return new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
