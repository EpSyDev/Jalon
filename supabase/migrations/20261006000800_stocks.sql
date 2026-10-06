-- Stocks : seuil d'alerte facultatif, stock courant calculé (jamais stocké), sortie impossible au-delà du stock.

alter table public.articles_stock
  add column seuil_alerte numeric(12, 3) check (seuil_alerte >= 0),
  add constraint articles_stock_libelle_check check (char_length(libelle) between 1 and 200),
  add constraint articles_stock_reference_check check (char_length(reference) <= 60),
  add constraint articles_stock_unite_check check (char_length(unite) <= 20);

create unique index articles_stock_reference_unique on public.articles_stock (lower(reference))
  where reference is not null and archive_le is null;

create function public.stock_article(article uuid) returns numeric
language sql stable
set search_path = ''
as $$
  select coalesce(sum(case when m.sens = 'entree' then m.quantite else -m.quantite end), 0)
  from public.mouvements_stock m
  where m.article_id = article and m.archive_le is null
$$;

create function public.verifier_sortie_stock() returns trigger
language plpgsql
set search_path = ''
as $$
declare disponible numeric;
begin
  if new.sens = 'sortie' then
    -- Verrou sur l'article : deux sorties simultanées ne peuvent pas dépasser le stock.
    perform 1 from public.articles_stock where id = new.article_id for update;
    disponible := public.stock_article(new.article_id);
    if new.quantite > disponible then
      raise exception 'Stock insuffisant : % disponible(s).', replace(trim_scale(disponible)::text, '.', ',')
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger verifier_sortie_stock before insert on public.mouvements_stock
for each row execute function public.verifier_sortie_stock();

create view public.v_stocks with (security_invoker = true) as
select a.id, a.reference, a.libelle, a.unite, a.seuil_alerte, a.notes,
  public.stock_article(a.id) as stock,
  (a.seuil_alerte is not null and public.stock_article(a.id) <= a.seuil_alerte) as sous_seuil,
  (select max(m.date_mouvement) from public.mouvements_stock m where m.article_id = a.id and m.archive_le is null)
    as dernier_mouvement
from public.articles_stock a
where a.archive_le is null;

revoke all on public.v_stocks from anon;
grant select on public.v_stocks to authenticated;
