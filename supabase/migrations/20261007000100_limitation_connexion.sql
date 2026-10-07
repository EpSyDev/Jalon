-- Limitation des tentatives de connexion, de double authentification et de « mot de passe oublié ».
-- Les limites de Supabase Auth s'appliquent par adresse IP de l'appelant, c'est-à-dire du serveur Vercel :
-- elles ne distinguent pas un attaquant d'un utilisateur légitime. Cette table le fait côté application.
-- Schéma « prive » : jamais exposé par l'API de données de Supabase, inaccessible aux rôles utilisateurs.

create schema if not exists prive;
revoke all on schema prive from public;
grant usage on schema prive to service_role;

create table prive.tentatives_connexion (
  id bigint generated always as identity primary key,
  -- Empreinte SHA-256 (hexadécimal) de « nature:valeur » : ni adresse mail ni adresse IP en clair.
  cle text not null check (cle ~ '^[0-9a-f]{64}$'),
  cree_le timestamptz not null default now()
);

create index on prive.tentatives_connexion (cle, cree_le);
alter table prive.tentatives_connexion enable row level security;
revoke all on prive.tentatives_connexion from public, anon, authenticated;

-- Vrai si la clé a atteint le maximum d'échecs sur la fenêtre. Purge au passage les traces de plus d'un jour
-- (minimisation des données).
create function prive.limite_atteinte(p_cle text, p_max integer, p_minutes integer) returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from prive.tentatives_connexion where cree_le < now() - interval '1 day';
  return (
    select count(*) from prive.tentatives_connexion
    where cle = p_cle and cree_le > now() - make_interval(mins => p_minutes)
  ) >= p_max;
end $$;

create function prive.noter_echec(p_cle text) returns void
language sql security definer
set search_path = ''
as $$ insert into prive.tentatives_connexion (cle) values (p_cle) $$;

revoke all on function prive.limite_atteinte(text, integer, integer) from public, anon, authenticated;
revoke all on function prive.noter_echec(text) from public, anon, authenticated;
grant execute on function prive.limite_atteinte(text, integer, integer) to service_role;
grant execute on function prive.noter_echec(text) to service_role;
