-- Comptes de développement LOCAL uniquement (supabase start). Jamais en production.
-- Mot de passe commun : Jalon-dev-2026

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Jalon-dev-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('nom', u.nom), now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@jalon.local', 'Alice Admin'),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'technicien@jalon.local', 'Thomas Technicien'),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'lecture@jalon.local', 'Léa Lecture')
) as u (id, email, nom);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@jalon.local';

update public.profils set role = 'admin' where id = '00000000-0000-4000-a000-000000000001';
update public.profils set role = 'technicien' where id = '00000000-0000-4000-a000-000000000002';
