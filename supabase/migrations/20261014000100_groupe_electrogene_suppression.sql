-- 1. Suivi des EPI (équipements de protection individuelle) avec date de péremption : table, rappels, journal.
-- 2. Suppression définitive, en plus de l'archivage, pour quelques fiches seulement : réservée à l'administrateur
--    (2FA validée), refusée si l'élément est encore utilisé ailleurs (clés étrangères), tracée au journal avec
--    son contenu complet. L'historique (contrôles, interventions, relevés…) n'est jamais supprimable.
-- 3. Contacts : la recherche globale affiche l'organisation avant le nom.
-- 4. Contrôles très fréquents (essai mensuel du groupe électrogène) : le seuil « à échéance » ne dépasse jamais la
--    moitié de la période, sinon un contrôle mensuel ne serait jamais « à jour ».

-- ---------------------------------------------------------------------------
-- EPI
-- ---------------------------------------------------------------------------

create table public.epi (
  id uuid primary key default gen_random_uuid(),
  libelle text not null check (char_length(libelle) between 1 and 200),
  detail text check (char_length(detail) <= 120),
  quantite integer not null default 1 check (quantite between 1 and 9999),
  date_peremption date,
  localisation_id uuid references public.localisations (id),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create index on public.epi (date_peremption);
create index on public.epi (localisation_id);

alter table public.rappels_envoyes drop constraint rappels_envoyes_cible_type_check;
alter table public.rappels_envoyes add constraint rappels_envoyes_cible_type_check
  check (cible_type in ('plan_controle', 'contrat', 'reserve', 'recap_hebdo', 'epi'));

-- ---------------------------------------------------------------------------
-- Journal : les suppressions y sont consignées (contenu complet dans « avant »).
-- ---------------------------------------------------------------------------

alter table public.journal_audit drop constraint journal_audit_action_check;
alter table public.journal_audit add constraint journal_audit_action_check
  check (action in ('insert', 'update', 'archive', 'delete'));

create or replace function public.journaliser() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_action text;
  v_id text;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
  elsif (to_jsonb(old) ->> 'archive_le') is null and (to_jsonb(new) ->> 'archive_le') is not null then
    v_action := 'archive';
  else
    v_action := 'update';
  end if;

  v_id := case when tg_op = 'DELETE' then coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'cle')
    else coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'cle') end;

  insert into public.journal_audit (table_cible, enregistrement_id, action, utilisateur_id, avant, apres)
  values (
    tg_table_name, v_id, v_action, auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Suppression : administrateur seulement (2FA validée), jamais hors de l'application.
-- ---------------------------------------------------------------------------

create function public.verifier_suppression() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.role_utilisateur() is distinct from 'admin' then
    raise exception 'Seul un administrateur peut supprimer.' using errcode = 'insufficient_privilege';
  end if;
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'epi', 'contacts', 'prestataires', 'contrats', 'equipements', 'localisations', 'univers', 'categories_equipement'
  ] loop
    if t = 'epi' then
      execute 'create trigger maj_updated_at before update on public.epi for each row execute function public.maj_updated_at()';
      execute 'create trigger verifier_archivage before update of archive_le on public.epi
        for each row execute function public.verifier_archivage()';
      execute 'revoke all on public.epi from anon';
      execute 'alter table public.epi enable row level security';
      execute 'create policy lecture on public.epi for select to authenticated
        using (public.role_utilisateur() is not null)';
      execute 'create policy creation on public.epi for insert to authenticated
        with check (public.role_utilisateur() in (''admin'', ''technicien''))';
      execute 'create policy modification on public.epi for update to authenticated
        using (public.role_utilisateur() in (''admin'', ''technicien''))
        with check (public.role_utilisateur() in (''admin'', ''technicien''))';
    else
      execute format('drop trigger interdire_suppression on public.%I', t);
      execute format('drop trigger journaliser on public.%I', t);
    end if;
    execute format('create trigger journaliser after insert or update or delete on public.%I
      for each row execute function public.journaliser()', t);
    execute format('create trigger verifier_suppression before delete on public.%I
      for each row execute function public.verifier_suppression()', t);
    execute format('grant delete on public.%I to authenticated', t);
    execute format('create policy suppression on public.%I for delete to authenticated
      using (public.role_utilisateur() = ''admin'')', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Recherche globale : contacts par organisation d'abord (même définition que 20261007000300).
-- ---------------------------------------------------------------------------

create or replace view public.v_recherche with (security_invoker = true) as
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
where ch.archive_le is null
union all
select 'contact', ct.id, coalesce(ct.organisation, ct.nom),
  concat_ws(' · ', case when ct.organisation is not null then ct.nom end, ct.fonction, ct.telephone),
  '/contacts/' || ct.id,
  public.normaliser(concat_ws(' ', ct.nom, ct.organisation, ct.fonction, ct.telephone, ct.email))
from public.contacts ct
where ct.archive_le is null
union all
select 'epi', x.id, x.libelle, concat_ws(' · ', x.detail, 'x' || x.quantite), '/groupe-electrogene/epi/' || x.id,
  public.normaliser(concat_ws(' ', x.libelle, x.detail, x.notes))
from public.epi x
where x.archive_le is null;

-- ---------------------------------------------------------------------------
-- Seuil « à échéance » plafonné à la moitié de la période (30 jours par mois / 2). Mois = périodicité du plan.
-- Miroir exact de seuilEffectif dans src/lib/metier/echeance.ts (test de parité automatique).
-- ---------------------------------------------------------------------------

create function public.seuil_effectif(seuil_jours integer, periodicite_mois integer) returns integer
language sql immutable
set search_path = ''
as $$ select least(seuil_jours, periodicite_mois * 15) $$;

create or replace view public.v_plans_controle_echeance with (security_invoker = true) as
with dernier as (
  select c.plan_controle_id, max(c.date_realisation) as dernier_controle
  from public.controles c
  where c.archive_le is null
  group by c.plan_controle_id
),
res as (
  select c.plan_controle_id,
    count(*) filter (where r.statut = 'ouverte') as nb_reserves_ouvertes,
    count(*) filter (where r.statut = 'levee') as nb_reserves_levees
  from public.reserves r
  join public.controles c on c.id = r.controle_id and c.archive_le is null
  where r.archive_le is null
  group by c.plan_controle_id
),
seuil as (
  select coalesce((select (valeur #>> '{}')::integer from public.parametres where cle = 'seuil_a_echeance_jours'), 60) as jours
),
base as (
  select
    p.id as plan_controle_id,
    p.type_controle_id,
    t.libelle as type_libelle,
    t.caractere,
    t.famille_id,
    p.equipement_id,
    e.code as equipement_code,
    coalesce(p.perimetre_libelle, e.libelle) as perimetre,
    p.prestataire_id,
    coalesce(p.periodicite_mois_surcharge, t.periodicite_mois) as periodicite_mois,
    d.dernier_controle,
    public.prochaine_echeance(d.dernier_controle, coalesce(p.periodicite_mois_surcharge, t.periodicite_mois)) as prochaine_echeance,
    coalesce(r.nb_reserves_ouvertes, 0)::integer as nb_reserves_ouvertes,
    coalesce(r.nb_reserves_levees, 0)::integer as nb_reserves_levees
  from public.plans_controle p
  join public.types_controle t on t.id = p.type_controle_id and t.archive_le is null
  left join public.equipements e on e.id = p.equipement_id
  left join dernier d on d.plan_controle_id = p.id
  left join res r on r.plan_controle_id = p.id
  where p.actif
    and p.archive_le is null
    and (p.equipement_id is null or (e.archive_le is null and e.statut not in ('reforme', 'declasse')))
)
select
  b.*,
  public.statut_echeance(b.prochaine_echeance, public.aujourdhui(), public.seuil_effectif(s.jours, b.periodicite_mois)) as statut_echeance,
  b.nb_reserves_ouvertes > 0 as reserves_ouvertes
from base b cross join seuil s;
