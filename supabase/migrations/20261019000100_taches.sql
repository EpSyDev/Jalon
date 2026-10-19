-- Tâches en cours : petit pense-bête partagé (« commande X », « agrafes reproduction », « serrure chambre 12 »…).
-- Une tâche est ouverte jusqu'à ce qu'elle soit résolue ; elle peut être rouverte. Jamais supprimée (historique).
-- Aucune donnée patient.

create table public.taches (
  id uuid primary key default gen_random_uuid(),
  libelle text not null check (char_length(libelle) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  echeance date,
  resolue_le timestamptz,
  resolue_par uuid references public.profils (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id)
);

create index on public.taches (resolue_le);

create trigger maj_updated_at before update on public.taches
for each row execute function public.maj_updated_at();
create trigger journaliser after insert or update on public.taches
for each row execute function public.journaliser();
create trigger interdire_suppression before delete on public.taches
for each row execute function public.interdire_suppression();

revoke all on public.taches from anon;
revoke delete, truncate, references, trigger on public.taches from authenticated;

alter table public.taches enable row level security;
create policy lecture on public.taches for select to authenticated
  using (public.role_utilisateur() is not null);
create policy creation on public.taches for insert to authenticated
  with check (public.role_utilisateur() in ('admin', 'technicien'));
create policy modification on public.taches for update to authenticated
  using (public.role_utilisateur() in ('admin', 'technicien'))
  with check (public.role_utilisateur() in ('admin', 'technicien'));
