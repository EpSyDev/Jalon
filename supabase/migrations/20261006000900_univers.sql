-- Univers : grands ensembles du parc (ex. Chauffage-ventilation, Électricité, Biomédical).
-- On crée les univers d'abord, puis on y rattache les équipements.

create table public.univers (
  id uuid primary key default gen_random_uuid(),
  libelle text not null check (char_length(libelle) between 1 and 120),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

-- Un nom d'univers actif est unique, sans tenir compte des accents ni de la casse.
create unique index univers_libelle_unique on public.univers (public.normaliser(libelle)) where archive_le is null;

alter table public.equipements add column univers_id uuid references public.univers (id);
create index on public.equipements (univers_id);

create trigger maj_updated_at before update on public.univers
for each row execute function public.maj_updated_at();
create trigger journaliser after insert or update on public.univers
for each row execute function public.journaliser();
create trigger verifier_archivage before update of archive_le on public.univers
for each row execute function public.verifier_archivage();
create trigger interdire_suppression before delete on public.univers
for each row execute function public.interdire_suppression();

revoke all on public.univers from anon;
revoke delete, truncate, references, trigger on public.univers from authenticated;

alter table public.univers enable row level security;
create policy lecture on public.univers for select to authenticated
  using (public.role_utilisateur() is not null);
create policy creation on public.univers for insert to authenticated
  with check (public.role_utilisateur() in ('admin', 'technicien'));
create policy modification on public.univers for update to authenticated
  using (public.role_utilisateur() in ('admin', 'technicien'))
  with check (public.role_utilisateur() in ('admin', 'technicien'));
