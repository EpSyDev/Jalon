-- Rappels : seuils paramétrables (J1 à J365) au lieu de la liste figée J60/J30/J7.

alter table public.rappels_envoyes drop constraint rappels_envoyes_seuil_check;
alter table public.rappels_envoyes add constraint rappels_envoyes_seuil_check
  check (seuil ~ '^(J([1-9]|[1-9][0-9]|[1-2][0-9]{2}|3[0-5][0-9]|36[0-5])|retard)$');

-- Le cron écrit avec le rôle service_role (jamais avec un rôle utilisateur).
grant select, insert on public.rappels_envoyes to service_role;
