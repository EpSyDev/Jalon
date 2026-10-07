-- Relevés périodiques : températures, pressions, compteurs… un point de relevé a une périodicité en jours et
-- des seuils facultatifs FIXÉS PAR L'UTILISATEUR (Jalon n'en propose aucun). Le retard et le dépassement de
-- seuil sont calculés par l'application ; la base garantit seulement la cohérence des données.

create table public.points_releve (
  id uuid primary key default gen_random_uuid(),
  libelle text not null check (char_length(libelle) between 1 and 200),
  unite text check (char_length(unite) <= 20),
  equipement_id uuid references public.equipements (id),
  localisation_id uuid references public.localisations (id),
  periodicite_jours integer not null check (periodicite_jours between 1 and 366),
  seuil_min numeric(14, 4),
  seuil_max numeric(14, 4),
  notes text check (char_length(notes) <= 2000),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz,
  check (seuil_min is null or seuil_max is null or seuil_min <= seuil_max)
);

create table public.releves (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.points_releve (id),
  date_releve date not null default public.aujourdhui(),
  valeur numeric(14, 4) not null,
  commentaire text check (char_length(commentaire) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create index on public.points_releve (equipement_id);
create index on public.points_releve (localisation_id);
create index on public.releves (point_id, date_releve desc);

do $$
declare t text;
begin
  foreach t in array array['points_releve', 'releves'] loop
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

-- Un relevé est un fait constaté : jamais daté du futur (fonction créée par la migration 20261007000200).
create trigger refuser_date_future before insert or update of date_releve on public.releves
for each row execute function public.refuser_date_future('date_releve', 'relevé');
