-- Droits et Row Level Security.
-- anon : rien. authenticated : lecture si profil actif, écriture pour admin/technicien,
-- jamais de DELETE. Paramètres, profils et journal : périmètre admin.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke delete, truncate on tables from authenticated;

revoke delete, truncate, references, trigger on all tables in schema public from authenticated;

-- Tables à écriture strictement contrôlée
revoke insert, update on public.journal_audit, public.rappels_envoyes from authenticated;
revoke insert on public.profils, public.parametres from authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'localisations', 'prestataires', 'familles_controle', 'equipements', 'contrats',
    'types_controle', 'plans_controle', 'controles', 'reserves', 'chantiers', 'interventions',
    'articles_stock', 'mouvements_stock'
  ] loop
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

alter table public.profils enable row level security;
create policy lecture on public.profils for select to authenticated
  using (public.role_utilisateur() is not null);
create policy modification on public.profils for update to authenticated
  using (public.role_utilisateur() = 'admin')
  with check (public.role_utilisateur() = 'admin');

alter table public.parametres enable row level security;
create policy lecture on public.parametres for select to authenticated
  using (public.role_utilisateur() is not null);
create policy modification on public.parametres for update to authenticated
  using (public.role_utilisateur() = 'admin')
  with check (public.role_utilisateur() = 'admin');

alter table public.journal_audit enable row level security;
create policy lecture on public.journal_audit for select to authenticated
  using (public.role_utilisateur() = 'admin');

alter table public.rappels_envoyes enable row level security;
create policy lecture on public.rappels_envoyes for select to authenticated
  using (public.role_utilisateur() = 'admin');
