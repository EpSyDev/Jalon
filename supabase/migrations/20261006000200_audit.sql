-- Journal d'audit alimenté uniquement par triggers, et garde sur l'archivage.

create table public.journal_audit (
  id bigint generated always as identity primary key,
  table_cible text not null,
  enregistrement_id text not null,
  action text not null check (action in ('insert', 'update', 'archive')),
  utilisateur_id uuid,
  avant jsonb,
  apres jsonb,
  cree_le timestamptz not null default now()
);

create index on public.journal_audit (table_cible, enregistrement_id);
create index on public.journal_audit (cree_le desc);

create function public.journaliser() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_action text;
  v_id text;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
  elsif (to_jsonb(old) ->> 'archive_le') is null and (to_jsonb(new) ->> 'archive_le') is not null then
    v_action := 'archive';
  else
    v_action := 'update';
  end if;

  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'cle');

  insert into public.journal_audit (table_cible, enregistrement_id, action, utilisateur_id, avant, apres)
  values (
    tg_table_name, v_id, v_action, auth.uid(),
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return null;
end $$;

-- Archiver = supprimer logiquement : réservé aux admins.
-- Les contextes sans utilisateur (migrations, seed, cron service_role) ne sont pas concernés.
create function public.verifier_archivage() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archive_le is distinct from old.archive_le
     and auth.uid() is not null
     and public.role_utilisateur() is distinct from 'admin' then
    raise exception 'Seul un administrateur peut archiver ou désarchiver.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- Ceinture et bretelles : même si un droit DELETE était accordé par erreur.
create function public.interdire_suppression() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Suppression interdite : utiliser l''archivage.' using errcode = 'insufficient_privilege';
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profils', 'localisations', 'prestataires', 'familles_controle', 'equipements', 'contrats',
    'types_controle', 'plans_controle', 'controles', 'reserves', 'chantiers', 'interventions',
    'articles_stock', 'mouvements_stock'
  ] loop
    execute format('create trigger journaliser after insert or update on public.%I
      for each row execute function public.journaliser()', t);
    execute format('create trigger verifier_archivage before update of archive_le on public.%I
      for each row execute function public.verifier_archivage()', t);
    execute format('create trigger interdire_suppression before delete on public.%I
      for each row execute function public.interdire_suppression()', t);
  end loop;
end $$;

create trigger journaliser after insert or update on public.parametres
for each row execute function public.journaliser();

create trigger interdire_suppression before delete on public.parametres
for each row execute function public.interdire_suppression();
