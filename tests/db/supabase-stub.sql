-- Reproduction minimale de l'environnement Supabase pour les tests PGlite :
-- rôles, schéma auth, auth.uid(), et droits par défaut (Supabase accorde tout à anon/authenticated,
-- ce sont nos migrations qui doivent les restreindre — c'est précisément ce qu'on teste).

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);

create function auth.jwt() returns jsonb
language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
