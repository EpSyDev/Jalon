import "server-only";
import type { Tx } from "@/lib/db";
import { idsLies, type Entree } from "@/lib/metier/journal";

export type Historique = { entrees: Entree[]; noms: Record<string, string> };

// Journal d'audit : lisible par les administrateurs seulement (RLS). Pour un autre rôle, les requêtes
// renvoient simplement des listes vides.

export const ENTREES_PAR_PAGE = 50;

export async function lireJournal(
  tx: Tx,
  filtres: { table?: string; page: number },
): Promise<Historique & { total: number }> {
  const lignes = await tx<(Entree & { total: number })[]>`
    select j.id, j.table_cible, j.enregistrement_id, j.action, p.nom as utilisateur_nom, j.avant, j.apres, j.cree_le,
      (count(*) over ())::int as total
    from public.journal_audit j
    left join public.profils p on p.id = j.utilisateur_id
    where (${filtres.table ?? null}::text is null or j.table_cible = ${filtres.table ?? null})
    order by j.id desc
    limit ${ENTREES_PAR_PAGE} offset ${(Math.max(filtres.page, 1) - 1) * ENTREES_PAR_PAGE}`;
  return { entrees: lignes, noms: await nommerLiens(tx, idsLies(lignes)), total: lignes[0]?.total ?? 0 };
}

/**
 * Historique d'une fiche : l'enregistrement lui-même et, pour un plan de contrôle, ses contrôles et réserves
 * (c'est là que l'on voit « qui a changé cette échéance »).
 */
export async function historiqueFiche(
  tx: Tx,
  table: "equipements" | "plans_controle" | "contrats",
  id: string,
  limite = 30,
): Promise<Historique> {
  const entrees = await tx<Entree[]>`
    select j.id, j.table_cible, j.enregistrement_id, j.action, p.nom as utilisateur_nom, j.avant, j.apres, j.cree_le
    from public.journal_audit j
    left join public.profils p on p.id = j.utilisateur_id
    where (j.table_cible = ${table} and j.enregistrement_id = ${id})
      or (${table} = 'plans_controle' and j.table_cible = 'controles' and j.apres ->> 'plan_controle_id' = ${id})
      or (${table} = 'plans_controle' and j.table_cible = 'reserves' and j.enregistrement_id in (
        select r.id::text from public.reserves r
        join public.controles c on c.id = r.controle_id
        where c.plan_controle_id = ${id}::uuid))
    order by j.id desc
    limit ${limite}`;
  return { entrees, noms: await nommerLiens(tx, idsLies(entrees)) };
}

/** Pour un rôle sans accès au journal : rien à afficher. */
export const HISTORIQUE_VIDE: Historique = { entrees: [], noms: {} };

/** Noms lisibles des éléments liés cités dans le journal (univers, localisation, prestataire…). */
export async function nommerLiens(tx: Tx, ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const lignes = await tx<{ id: string; nom: string }[]>`
    with cibles as (select unnest(${ids}::uuid[]) as id)
    select u.id::text, u.libelle as nom from public.univers u join cibles using (id)
    union all select l.id::text, l.libelle_complet from public.localisations l join cibles using (id)
    union all select f.id::text, f.libelle from public.familles_controle f join cibles using (id)
    union all select p.id::text, p.nom from public.prestataires p join cibles using (id)
    union all select c.id::text, c.objet from public.contrats c join cibles using (id)
    union all select e.id::text, e.code from public.equipements e join cibles using (id)
    union all select t.id::text, t.libelle from public.types_controle t join cibles using (id)
    union all select ch.id::text, ch.titre from public.chantiers ch join cibles using (id)
    union all select a.id::text, a.libelle from public.articles_stock a join cibles using (id)
    union all select pr.id::text, pr.nom from public.profils pr join cibles using (id)`;
  return Object.fromEntries(lignes.map((l) => [l.id, l.nom]));
}
