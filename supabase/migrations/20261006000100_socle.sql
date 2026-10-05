-- Socle : fonctions utilitaires, référentiels, parc, contrôles, interventions, contrats, transverse.
-- Conventions : uuid, created_at/updated_at/created_by, archivage logique via archive_le.

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

-- Date du jour à Paris. Ne jamais utiliser current_date (UTC sur Supabase).
create function public.aujourdhui() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Paris')::date $$;

create function public.maj_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profils (1 ligne par compte auth)
-- ---------------------------------------------------------------------------

create table public.profils (
  id uuid primary key references auth.users (id),
  nom text not null check (char_length(nom) between 1 and 120),
  role text not null default 'lecture' check (role in ('admin', 'technicien', 'lecture')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archive_le timestamptz
);

-- Rôle effectif de l'utilisateur courant (null si pas de profil actif).
-- Un admin sans 2FA validée dans la session (aal2) n'a que les droits de lecture.
create function public.role_utilisateur() returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when p.role = 'admin' and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then 'lecture'
    else p.role
  end
  from public.profils p
  where p.id = auth.uid() and p.archive_le is null
$$;

-- Tout nouveau compte reçoit un profil « lecture ». Promotion par un admin.
create function public.creer_profil() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profils (id, nom)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nom', ''), new.email, 'Sans nom'));
  return new;
end $$;

create trigger creer_profil after insert on auth.users
for each row execute function public.creer_profil();

-- ---------------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------------

create table public.localisations (
  id uuid primary key default gen_random_uuid(),
  batiment text not null check (char_length(batiment) <= 120),
  niveau text check (char_length(niveau) <= 60),
  local text check (char_length(local) <= 120),
  libelle_complet text generated always as (
    batiment || coalesce(' / ' || niveau, '') || coalesce(' / ' || local, '')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create table public.prestataires (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 200),
  contact_nom text check (char_length(contact_nom) <= 200),
  email text check (char_length(email) <= 254),
  telephone text check (char_length(telephone) <= 30),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create table public.familles_controle (
  id uuid primary key default gen_random_uuid(),
  libelle text not null unique check (char_length(libelle) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

-- ---------------------------------------------------------------------------
-- Parc matériel
-- ---------------------------------------------------------------------------

create table public.equipements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 60),
  libelle text not null check (char_length(libelle) between 1 and 200),
  famille_id uuid references public.familles_controle (id),
  localisation_id uuid references public.localisations (id),
  marque text check (char_length(marque) <= 120),
  modele text check (char_length(modele) <= 120),
  numero_serie text check (char_length(numero_serie) <= 120),
  date_mise_en_service date,
  statut text not null default 'en_service' check (statut in ('en_service', 'hors_service', 'reforme')),
  -- 122 bits aléatoires, distinct de l'id. La fiche reste derrière authentification.
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

-- ---------------------------------------------------------------------------
-- Contrats
-- ---------------------------------------------------------------------------

create table public.contrats (
  id uuid primary key default gen_random_uuid(),
  prestataire_id uuid not null references public.prestataires (id),
  objet text not null check (char_length(objet) between 1 and 300),
  reference text check (char_length(reference) <= 120),
  date_debut date,
  date_fin date,
  reconduction_tacite boolean not null default false,
  preavis_jours integer check (preavis_jours between 0 and 730),
  montant_annuel numeric(12, 2) check (montant_annuel >= 0),
  reference_document text check (char_length(reference_document) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

-- ---------------------------------------------------------------------------
-- Contrôles réglementaires
-- ---------------------------------------------------------------------------

create table public.types_controle (
  id uuid primary key default gen_random_uuid(),
  libelle text not null check (char_length(libelle) between 1 and 200),
  famille_id uuid not null references public.familles_controle (id),
  caractere text not null check (caractere in ('reglementaire', 'obligatoire', 'interne')),
  periodicite_mois integer not null check (periodicite_mois between 1 and 120),
  reference_texte text check (char_length(reference_texte) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create table public.plans_controle (
  id uuid primary key default gen_random_uuid(),
  type_controle_id uuid not null references public.types_controle (id),
  equipement_id uuid references public.equipements (id),
  perimetre_libelle text check (char_length(perimetre_libelle) <= 200),
  prestataire_id uuid references public.prestataires (id),
  contrat_id uuid references public.contrats (id),
  periodicite_mois_surcharge integer check (periodicite_mois_surcharge between 1 and 120),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  -- Un plan porte sur un équipement ou sur une installation décrite en clair.
  check (equipement_id is not null or perimetre_libelle is not null)
);

create table public.controles (
  id uuid primary key default gen_random_uuid(),
  plan_controle_id uuid not null references public.plans_controle (id),
  date_realisation date not null,
  resultat text not null check (resultat in ('conforme', 'avec_reserves', 'non_conforme')),
  nb_reserves_declare integer check (nb_reserves_declare between 0 and 500),
  reference_rapport text check (char_length(reference_rapport) <= 500),
  commentaire text check (char_length(commentaire) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create function public.verifier_date_realisation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_realisation > public.aujourdhui() then
    raise exception 'La date de réalisation ne peut pas être dans le futur.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger verifier_date_realisation before insert or update of date_realisation on public.controles
for each row execute function public.verifier_date_realisation();

create table public.reserves (
  id uuid primary key default gen_random_uuid(),
  controle_id uuid not null references public.controles (id),
  description text not null default 'À détailler' check (char_length(description) between 1 and 2000),
  gravite text check (gravite in ('mineure', 'majeure', 'critique')),
  date_constat date not null,
  echeance_levee date,
  date_levee date,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'levee')),
  commentaire text check (char_length(commentaire) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  check ((statut = 'levee') = (date_levee is not null)),
  check (date_levee is null or date_levee >= date_constat)
);

-- ---------------------------------------------------------------------------
-- Interventions et chantiers
-- ---------------------------------------------------------------------------

create table public.chantiers (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(titre) between 1 and 200),
  description text check (char_length(description) <= 2000),
  statut text not null default 'prevu' check (statut in ('prevu', 'en_cours', 'suspendu', 'termine', 'annule')),
  date_debut date,
  date_fin_prevue date,
  date_fin_reelle date,
  responsable_id uuid references public.profils (id),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  check (date_fin_prevue is null or date_debut is null or date_fin_prevue >= date_debut),
  check (date_fin_reelle is null or date_debut is null or date_fin_reelle >= date_debut)
);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'corrective' check (type in ('corrective', 'preventive', 'autre')),
  titre text not null check (char_length(titre) between 1 and 200),
  description text check (char_length(description) <= 2000),
  equipement_id uuid references public.equipements (id),
  plan_controle_id uuid references public.plans_controle (id),
  chantier_id uuid references public.chantiers (id),
  statut text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'en_attente', 'terminee', 'annulee')),
  priorite text not null default 'normale' check (priorite in ('basse', 'normale', 'haute', 'urgente')),
  date_demande date not null default public.aujourdhui(),
  date_prevue date,
  date_cloture date,
  assignee_id uuid references public.profils (id),
  prestataire_id uuid references public.prestataires (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  check ((statut in ('terminee', 'annulee')) = (date_cloture is not null)),
  check (date_cloture is null or date_cloture >= date_demande)
);

-- ---------------------------------------------------------------------------
-- Transverse
-- ---------------------------------------------------------------------------

create table public.rappels_envoyes (
  id uuid primary key default gen_random_uuid(),
  cible_type text not null check (cible_type in ('plan_controle', 'contrat', 'reserve', 'recap_hebdo')),
  cible_id uuid,
  seuil text not null check (seuil in ('J60', 'J30', 'J7', 'retard')),
  -- Échéance visée : un nouveau contrôle ouvre un nouveau cycle de rappels.
  echeance date not null,
  envoye_le timestamptz not null default now(),
  unique nulls not distinct (cible_type, cible_id, seuil, echeance)
);

create table public.parametres (
  cle text primary key check (cle ~ '^[a-z0-9_]{1,60}$'),
  valeur jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profils (id)
);

insert into public.parametres (cle, valeur, description) values
  ('seuil_a_echeance_jours', '60', 'Nombre de jours avant échéance à partir duquel un plan passe « à échéance ».'),
  ('seuils_rappel_jours', '[60, 30, 7]', 'Seuils des rappels mail avant échéance (jours).'),
  ('destinataires_rappels', '[]', 'Adresses mail recevant les rappels et le récapitulatif.'),
  ('jour_recap_hebdo', '1', 'Jour ISO du récapitulatif hebdomadaire (1 = lundi).');

-- ---------------------------------------------------------------------------
-- Squelettes (aucune logique pour l'instant)
-- ---------------------------------------------------------------------------

create table public.articles_stock (
  id uuid primary key default gen_random_uuid(),
  reference text,
  libelle text not null,
  unite text,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create table public.mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles_stock (id),
  sens text not null check (sens in ('entree', 'sortie')),
  quantite numeric(12, 3) not null check (quantite > 0),
  date_mouvement date not null default public.aujourdhui(),
  commentaire text check (char_length(commentaire) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

-- ---------------------------------------------------------------------------
-- Index sur les clés étrangères les plus sollicitées
-- ---------------------------------------------------------------------------

create index on public.equipements (localisation_id);
create index on public.equipements (famille_id);
create index on public.types_controle (famille_id);
create index on public.plans_controle (type_controle_id);
create index on public.plans_controle (equipement_id);
create index on public.controles (plan_controle_id, date_realisation desc);
create index on public.reserves (controle_id);
create index on public.interventions (equipement_id);
create index on public.interventions (statut, priorite);
create index on public.contrats (prestataire_id);
create index on public.mouvements_stock (article_id);

-- updated_at automatique
do $$
declare t text;
begin
  foreach t in array array[
    'profils', 'localisations', 'prestataires', 'familles_controle', 'equipements', 'contrats',
    'types_controle', 'plans_controle', 'controles', 'reserves', 'chantiers', 'interventions',
    'parametres', 'articles_stock', 'mouvements_stock'
  ] loop
    execute format('create trigger maj_updated_at before update on public.%I
      for each row execute function public.maj_updated_at()', t);
  end loop;
end $$;
