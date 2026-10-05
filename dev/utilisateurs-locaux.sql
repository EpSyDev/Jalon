-- Équivalent PGlite de supabase/seed/01_utilisateurs.sql (auth.users simplifiée). Comptes fictifs.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000001', 'admin@jalon.local', '{"nom":"Alice Admin"}'),
  ('00000000-0000-4000-a000-000000000002', 'technicien@jalon.local', '{"nom":"Thomas Technicien"}'),
  ('00000000-0000-4000-a000-000000000003', 'lecture@jalon.local', '{"nom":"Léa Lecture"}');
update public.profils set role = 'admin' where id = '00000000-0000-4000-a000-000000000001';
update public.profils set role = 'technicien' where id = '00000000-0000-4000-a000-000000000002';
