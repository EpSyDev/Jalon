import "server-only";
import type { Tx } from "@/lib/db";

export type ArticleStock = {
  id: string;
  reference: string | null;
  libelle: string;
  unite: string | null;
  seuil_alerte: string | null;
  notes: string | null;
  stock: string;
  sous_seuil: boolean;
  dernier_mouvement: string | null;
};

export function listerArticles(tx: Tx, sousSeuil: boolean) {
  return tx<ArticleStock[]>`
    select id, reference, libelle, unite, seuil_alerte::text, notes, stock::text, sous_seuil, dernier_mouvement
    from public.v_stocks
    where (not ${sousSeuil} or sous_seuil)
    order by sous_seuil desc, libelle`;
}

export async function lireArticle(tx: Tx, id: string): Promise<ArticleStock | undefined> {
  const [a] = await tx<ArticleStock[]>`
    select id, reference, libelle, unite, seuil_alerte::text, notes, stock::text, sous_seuil, dernier_mouvement
    from public.v_stocks where id = ${id}`;
  return a;
}

export function mouvementsArticle(tx: Tx, id: string) {
  return tx<
    {
      id: string;
      sens: "entree" | "sortie";
      quantite: string;
      date_mouvement: string;
      commentaire: string | null;
      auteur: string | null;
    }[]
  >`
    select m.id, m.sens, m.quantite::text, m.date_mouvement, m.commentaire, p.nom as auteur
    from public.mouvements_stock m
    left join public.profils p on p.id = m.created_by
    where m.article_id = ${id} and m.archive_le is null
    order by m.date_mouvement desc, m.created_at desc
    limit 100`;
}
