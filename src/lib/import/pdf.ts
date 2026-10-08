// Extraction du texte d'un PDF, en mémoire, sans service externe. Le fichier n'est jamais stocké.
import { extractText, getDocumentProxy } from "unpdf";

export const TAILLE_MAX_PDF = 10 * 1024 * 1024;
const PAGES_MAX = 200;
const SIGNATURE_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // « %PDF- »

export async function lireTextePdf(contenu: Uint8Array): Promise<{ pages?: string[]; erreur?: string }> {
  if (contenu.length === 0) return { erreur: "Fichier vide." };
  if (contenu.length > TAILLE_MAX_PDF) return { erreur: "PDF trop volumineux (10 Mo maximum)." };
  if (!SIGNATURE_PDF.every((o, i) => contenu[i] === o)) return { erreur: "Ce fichier n'est pas un PDF." };
  try {
    // pdf.js embarqué par unpdf (version serverless) : aucun recours à eval ; texte seulement, aucun rendu.
    const pdf = await getDocumentProxy(contenu);
    if (pdf.numPages > PAGES_MAX) return { erreur: `PDF trop long (${pdf.numPages} pages, ${PAGES_MAX} maximum).` };
    const { text } = await extractText(pdf, { mergePages: false });
    if (text.join("").trim().length < 50) {
      return {
        erreur:
          "Ce PDF ne contient pas de texte (document scanné) : la lecture des scans n'est pas prise en charge. Saisissez le contrôle à la main.",
      };
    }
    return { pages: text };
  } catch {
    return { erreur: "PDF illisible (protégé ou endommagé)." };
  }
}
