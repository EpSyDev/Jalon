-- Suivi des formations et habilitations du service : agents, types de formation (avec validité en mois, ex. 36 pour
-- l'habilitation électrique) et formations suivies (date, durée, organisme, échéance). Archivage seulement.
-- Données professionnelles uniquement (aucune donnée patient).

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 200),
  fonction text check (char_length(fonction) <= 120),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);
create unique index agents_nom_actif on public.agents (lower(nom)) where archive_le is null;

create table public.types_formation (
  id uuid primary key default gen_random_uuid(),
  libelle text not null check (char_length(libelle) between 1 and 200),
  -- Durée de validité en mois ; vide = sans échéance.
  validite_mois integer check (validite_mois between 1 and 240),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);
create unique index types_formation_libelle_actif on public.types_formation (lower(libelle)) where archive_le is null;

create table public.formations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id),
  type_formation_id uuid not null references public.types_formation (id),
  date_formation date not null,
  duree_heures numeric(6, 1) check (duree_heures > 0 and duree_heures <= 9999),
  organisme text check (char_length(organisme) <= 200),
  echeance date,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  check (echeance is null or echeance >= date_formation)
);
create index on public.formations (agent_id);
create index on public.formations (type_formation_id);
create index on public.formations (echeance);

do $$
declare t text;
begin
  foreach t in array array['agents', 'types_formation', 'formations'] loop
    execute format('create trigger maj_updated_at before update on public.%I
      for each row execute function public.maj_updated_at()', t);
    execute format('create trigger journaliser after insert or update on public.%I
      for each row execute function public.journaliser()', t);
    execute format('create trigger verifier_archivage before update of archive_le on public.%I
      for each row execute function public.verifier_archivage()', t);
    execute format('create trigger interdire_suppression before delete on public.%I
      for each row execute function public.interdire_suppression()', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete, truncate, references, trigger on public.%I from authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy lecture on public.%I for select to authenticated
      using (public.role_utilisateur() is not null)', t);
    execute format('create policy creation on public.%I for insert to authenticated
      with check (public.role_utilisateur() in (''admin'', ''technicien''))', t);
    execute format('create policy modification on public.%I for update to authenticated
      using (public.role_utilisateur() in (''admin'', ''technicien''))
      with check (public.role_utilisateur() in (''admin'', ''technicien''))', t);
  end loop;
end $$;
