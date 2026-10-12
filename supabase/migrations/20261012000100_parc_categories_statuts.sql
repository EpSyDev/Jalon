-- Parc : catégories de matériel et statuts détaillés des équipements.
--
-- 1. Catégories. La « famille » d'un équipement était une famille de contrôle : un import de matériel créait
--    AUTOTENSIOMETRE, OXYMETRE… comme familles de contrôle, et le parc proposait Électricité, Ascenseurs… dans tous
--    les univers. Désormais : univers → catégories de matériel → équipements ; les familles ne servent qu'aux contrôles.
--    Une catégorie sans univers est transversale (en attente de rangement) : utilisable dans tous les univers.
-- 2. Statuts : indisponible, réparation interne ou externe, déclassé (en plus d'en service, hors service, réformé),
--    avec depuis quand, pourquoi, chez quel prestataire et le retour prévu.

create table public.categories_equipement (
  id uuid primary key default gen_random_uuid(),
  univers_id uuid references public.univers (id),
  libelle text not null check (char_length(libelle) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

-- Un nom de catégorie active est unique dans son univers, sans tenir compte des accents ni de la casse.
create unique index categories_equipement_libelle_unique on public.categories_equipement
  (coalesce(univers_id, '00000000-0000-0000-0000-000000000000'::uuid), public.normaliser(libelle))
  where archive_le is null;
create index on public.categories_equipement (univers_id);

create trigger maj_updated_at before update on public.categories_equipement
for each row execute function public.maj_updated_at();
create trigger journaliser after insert or update on public.categories_equipement
for each row execute function public.journaliser();
create trigger verifier_archivage before update of archive_le on public.categories_equipement
for each row execute function public.verifier_archivage();
create trigger interdire_suppression before delete on public.categories_equipement
for each row execute function public.interdire_suppression();

revoke all on public.categories_equipement from anon;
revoke delete, truncate, references, trigger on public.categories_equipement from authenticated;

alter table public.categories_equipement enable row level security;
create policy lecture on public.categories_equipement for select to authenticated
  using (public.role_utilisateur() is not null);
create policy creation on public.categories_equipement for insert to authenticated
  with check (public.role_utilisateur() in ('admin', 'technicien'));
create policy modification on public.categories_equipement for update to authenticated
  using (public.role_utilisateur() in ('admin', 'technicien'))
  with check (public.role_utilisateur() in ('admin', 'technicien'));

-- ---------------------------------------------------------------------------
-- Équipements : catégorie et statut détaillé
-- ---------------------------------------------------------------------------

alter table public.equipements drop constraint equipements_statut_check;
alter table public.equipements
  add constraint equipements_statut_check check (statut in (
    'en_service', 'indisponible', 'reparation_interne', 'reparation_externe', 'hors_service', 'declasse', 'reforme'
  )),
  add column categorie_id uuid references public.categories_equipement (id),
  add column statut_depuis date,
  add column statut_motif text check (char_length(statut_motif) <= 500),
  add column statut_prestataire_id uuid references public.prestataires (id),
  add column statut_retour_prevu date,
  add constraint equipements_statut_prestataire check (statut_prestataire_id is null or statut = 'reparation_externe'),
  add constraint equipements_statut_retour check (
    statut_retour_prevu is null or statut in ('indisponible', 'reparation_interne', 'reparation_externe', 'hors_service')
  ),
  add constraint equipements_statut_retour_apres check (
    statut_retour_prevu is null or statut_depuis is null or statut_retour_prevu >= statut_depuis
  );
create index on public.equipements (categorie_id);
create index on public.equipements (statut_prestataire_id);

comment on column public.equipements.famille_id is
  'Obsolète depuis 20261012000100 : remplacée par categorie_id (les familles ne servent qu''aux contrôles).';

create trigger refuser_statut_futur before insert or update of statut_depuis on public.equipements
for each row execute function public.refuser_date_future('statut_depuis', 'début du statut');

-- Changement de statut sans date fournie : il commence aujourd'hui.
create function public.dater_statut_equipement() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.statut is distinct from old.statut and new.statut_depuis is not distinct from old.statut_depuis then
    new.statut_depuis := public.aujourdhui();
  end if;
  return new;
end $$;

create trigger dater_statut before update of statut on public.equipements
for each row execute function public.dater_statut_equipement();

-- La catégorie d'un équipement appartient à son univers (ou est transversale).
create function public.verifier_categorie_equipement() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_univers uuid;
begin
  if new.categorie_id is not null then
    select univers_id into v_univers from public.categories_equipement where id = new.categorie_id;
    if v_univers is not null and v_univers is distinct from new.univers_id then
      raise exception 'La catégorie choisie appartient à un autre univers.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger verifier_categorie before insert or update of categorie_id, univers_id on public.equipements
for each row execute function public.verifier_categorie_equipement();

-- Ranger une catégorie dans un univers y range aussi ses équipements.
create function public.propager_univers_categorie() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.univers_id is not null and new.univers_id is distinct from old.univers_id then
    update public.equipements set univers_id = new.univers_id
    where categorie_id = new.id and archive_le is null and univers_id is distinct from new.univers_id;
  end if;
  return null;
end $$;

create trigger propager_univers after update of univers_id on public.categories_equipement
for each row execute function public.propager_univers_categorie();

-- ---------------------------------------------------------------------------
-- Échéances : un équipement déclassé, comme un réformé, ne génère plus d'alerte.
-- Corps identique à 20261006000400_echeances.sql, seule la condition sur le statut change.
-- ---------------------------------------------------------------------------

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
  public.statut_echeance(b.prochaine_echeance, public.aujourdhui(), s.jours) as statut_echeance,
  b.nb_reserves_ouvertes > 0 as reserves_ouvertes
from base b cross join seuil s;

-- ---------------------------------------------------------------------------
-- Reprise des données : chaque famille portée par des équipements devient une catégorie de leur univers.
-- ---------------------------------------------------------------------------

insert into public.categories_equipement (univers_id, libelle)
select distinct on (e.univers_id, public.normaliser(f.libelle)) e.univers_id, f.libelle
from public.equipements e
join public.familles_controle f on f.id = e.famille_id
where e.archive_le is null
order by e.univers_id, public.normaliser(f.libelle), f.libelle;

-- Familles créées seulement pour classer du matériel (aucun type de contrôle) : retirées des listes de contrôles.
update public.familles_controle f set archive_le = now()
where f.archive_le is null
  and not exists (select 1 from public.types_controle t where t.famille_id = f.id)
  and exists (select 1 from public.equipements e where e.famille_id = f.id and e.archive_le is null);

update public.equipements e set categorie_id = c.id, famille_id = null
from public.familles_controle f, public.categories_equipement c
where f.id = e.famille_id
  and e.archive_le is null
  and c.univers_id is not distinct from e.univers_id
  and public.normaliser(c.libelle) = public.normaliser(f.libelle);
