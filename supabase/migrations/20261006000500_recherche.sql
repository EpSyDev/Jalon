-- Recherche globale : tolérante aux accents (unaccent) et aux fautes de frappe (pg_trgm).

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to authenticated, service_role;

-- Minuscules sans accents. Déclarée immuable (pratique standard autour d'unaccent).
create function public.normaliser(texte text) returns text
language sql immutable parallel safe
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texte, ''))) $$;

-- Un objet cherchable par ligne. security_invoker : la RLS de l'appelant s'applique.
create view public.v_recherche with (security_invoker = true) as
select 'equipement'::text as type, e.id, e.code || ' — ' || e.libelle as titre,
  l.libelle_complet as sous_titre, '/equipements/' || e.id as lien,
  public.normaliser(concat_ws(' ', e.code, e.libelle, e.marque, e.modele, e.numero_serie, l.libelle_complet)) as texte
from public.equipements e
left join public.localisations l on l.id = e.localisation_id
where e.archive_le is null
union all
select 'plan', p.id, t.libelle, coalesce(e.code || ' — ' || e.libelle, p.perimetre_libelle),
  '/controles/plans/' || p.id,
  public.normaliser(concat_ws(' ', t.libelle, f.libelle, e.code, e.libelle, p.perimetre_libelle, pr.nom))
from public.plans_controle p
join public.types_controle t on t.id = p.type_controle_id
join public.familles_controle f on f.id = t.famille_id
left join public.equipements e on e.id = p.equipement_id
left join public.prestataires pr on pr.id = p.prestataire_id
where p.archive_le is null
union all
select 'reserve', r.id, r.description, t.libelle, '/controles/plans/' || c.plan_controle_id,
  public.normaliser(concat_ws(' ', r.description, r.commentaire, t.libelle))
from public.reserves r
join public.controles c on c.id = r.controle_id and c.archive_le is null
join public.plans_controle p on p.id = c.plan_controle_id
join public.types_controle t on t.id = p.type_controle_id
where r.archive_le is null and r.statut = 'ouverte'
union all
select 'prestataire', pr.id, pr.nom, pr.contact_nom, '/prestataires/' || pr.id,
  public.normaliser(concat_ws(' ', pr.nom, pr.contact_nom, pr.email))
from public.prestataires pr
where pr.archive_le is null
union all
select 'contrat', c.id, c.objet, pr.nom, '/contrats/' || c.id,
  public.normaliser(concat_ws(' ', c.objet, c.reference, pr.nom))
from public.contrats c
join public.prestataires pr on pr.id = c.prestataire_id
where c.archive_le is null
union all
select 'intervention', i.id, i.titre, e.code, '/interventions/' || i.id,
  public.normaliser(concat_ws(' ', i.titre, i.description, e.code, e.libelle))
from public.interventions i
left join public.equipements e on e.id = i.equipement_id
where i.archive_le is null
union all
select 'chantier', ch.id, ch.titre, null, '/chantiers/' || ch.id,
  public.normaliser(concat_ws(' ', ch.titre, ch.description))
from public.chantiers ch
where ch.archive_le is null;

revoke all on public.v_recherche from anon;
grant select on public.v_recherche to authenticated;

-- Chaque mot doit être trouvé (tel quel ou approximativement). Tri par pertinence.
create function public.rechercher(requete text, limite integer default 20)
returns table (type text, id uuid, titre text, sous_titre text, lien text, score real)
language sql stable
set search_path = ''
as $$
  with mots as (
    select distinct m as mot
    from unnest(string_to_array(public.normaliser(trim(requete)), ' ')) m
    where length(m) > 0
  )
  select v.type, v.id, v.titre, v.sous_titre, v.lien,
    (select sum(case when strpos(v.texte, mot) > 0 then 1 else extensions.word_similarity(mot, v.texte) end)
     from mots)::real as score
  from public.v_recherche v
  where exists (select 1 from mots)
    and not exists (
      select 1 from mots
      where strpos(v.texte, mot) = 0 and extensions.word_similarity(mot, v.texte) < 0.45
    )
  order by score desc, v.titre
  limit least(greatest(limite, 1), 50)
$$;

revoke all on function public.rechercher(text, integer) from anon, public;
grant execute on function public.rechercher(text, integer) to authenticated;
