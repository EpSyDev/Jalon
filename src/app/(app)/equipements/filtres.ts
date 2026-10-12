// Filtres du parc lus dans l'adresse (page et export Excel) : toute valeur inattendue est ignorée.

import { AUCUN, filtreStatutValide } from "@/lib/metier/parc";
import type { FiltresParc } from "@/lib/requetes/parc";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Univers « tous » : la liste complète, sans passer par le choix d'un univers. */
export const TOUS = "tous";

export type FiltresAdresse = FiltresParc & { page: number };

export function lireFiltresParc(lire: (cle: string) => unknown): FiltresAdresse {
  const texte = (cle: string) => {
    const v = lire(cle);
    return typeof v === "string" && v.length <= 100 ? v : undefined;
  };
  const reference = (cle: string, speciales: string[]) => {
    const v = texte(cle);
    return v && (UUID.test(v) || speciales.includes(v)) ? v : undefined;
  };
  return {
    q: texte("q")?.trim() || undefined,
    univers: reference("univers", [AUCUN, TOUS]),
    categorie: reference("categorie", [AUCUN]),
    localisation: reference("localisation", [AUCUN]),
    statut: filtreStatutValide(texte("statut")),
    page: Math.min(Math.max(Number.parseInt(texte("page") ?? "1", 10) || 1, 1), 1000),
  };
}

/** Adresse de la liste avec ces filtres (page 1 sauf mention). */
export function adresseParc(filtres: Partial<FiltresAdresse>): string {
  const q = new URLSearchParams();
  for (const cle of ["univers", "categorie", "statut", "localisation", "q"] as const) {
    const v = filtres[cle];
    if (v) q.set(cle, v);
  }
  if (filtres.page && filtres.page > 1) q.set("page", String(filtres.page));
  return `/equipements${q.size ? `?${q}` : ""}`;
}
