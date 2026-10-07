-- Garde-fous de dates en base (dernière ligne de défense, en plus de Zod) et index des clés étrangères
-- encore non indexées. Aucune règle réglementaire : seulement « un fait constaté n'est pas dans le futur ».

-- Refuse une date postérieure à aujourd'hui (Paris). Colonne passée en argument du trigger.
create function public.refuser_date_future() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_date date := (to_jsonb(new) ->> tg_argv[0])::date;
begin
  if v_date > public.aujourdhui() then
    raise exception 'La date (%) ne peut pas être dans le futur.', tg_argv[1] using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger refuser_date_future before insert or update of date_levee on public.reserves
for each row execute function public.refuser_date_future('date_levee', 'levée');

create trigger refuser_date_future before insert or update of date_cloture on public.interventions
for each row execute function public.refuser_date_future('date_cloture', 'clôture');

create trigger refuser_date_future before insert or update of date_fin_reelle on public.chantiers
for each row execute function public.refuser_date_future('date_fin_reelle', 'fin réelle');

create trigger refuser_date_future before insert or update of date_mouvement on public.mouvements_stock
for each row execute function public.refuser_date_future('date_mouvement', 'mouvement');

create trigger refuser_date_future before insert or update of date_mise_en_service on public.equipements
for each row execute function public.refuser_date_future('date_mise_en_service', 'mise en service');

-- Clés étrangères sollicitées par les fiches (chantier, plan, prestataire, contrat) et par le journal.
create index if not exists interventions_chantier_id_idx on public.interventions (chantier_id);
create index if not exists interventions_plan_controle_id_idx on public.interventions (plan_controle_id);
create index if not exists plans_controle_prestataire_id_idx on public.plans_controle (prestataire_id);
create index if not exists plans_controle_contrat_id_idx on public.plans_controle (contrat_id);
