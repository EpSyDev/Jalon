-- Statistiques : indicateurs factuels calculés en SQL (aucun score composite).
-- security_invoker : la RLS de l'utilisateur s'applique.

-- 12 derniers mois (mois courant inclus), en heure de Paris.
create view public.v_stats_mois with (security_invoker = true) as
select m::date as mois
from generate_series(
  date_trunc('month', public.aujourdhui()) - interval '11 months',
  date_trunc('month', public.aujourdhui()),
  interval '1 month'
) m;

create view public.v_stats_controles_mois with (security_invoker = true) as
select m.mois,
  count(c.id)::int as realises,
  count(c.id) filter (where c.resultat <> 'conforme')::int as avec_ecarts
from public.v_stats_mois m
left join public.controles c
  on c.archive_le is null and date_trunc('month', c.date_realisation)::date = m.mois
group by m.mois;

create view public.v_stats_interventions_mois with (security_invoker = true) as
select m.mois,
  (select count(*) from public.interventions i
    where i.archive_le is null and date_trunc('month', i.date_demande)::date = m.mois)::int as creees,
  (select count(*) from public.interventions i
    where i.archive_le is null and i.statut = 'terminee' and date_trunc('month', i.date_cloture)::date = m.mois)::int
    as terminees
from public.v_stats_mois m;

-- Délai entre demande et fin, interventions terminées sur 12 mois glissants.
create view public.v_stats_delais_interventions with (security_invoker = true) as
select i.priorite,
  count(*)::int as terminees,
  round(avg(i.date_cloture - i.date_demande), 1)::float8 as delai_moyen_jours,
  percentile_cont(0.5) within group (order by i.date_cloture - i.date_demande)::float8 as delai_median_jours
from public.interventions i
where i.archive_le is null and i.statut = 'terminee' and i.date_cloture >= public.aujourdhui() - 365
group by i.priorite;

create view public.v_stats_reserves with (security_invoker = true) as
select
  count(*) filter (where r.statut = 'ouverte')::int as ouvertes,
  count(*) filter (where r.statut = 'ouverte' and r.echeance_levee < public.aujourdhui())::int as ouvertes_en_retard,
  count(*) filter (where r.statut = 'ouverte' and r.gravite = 'critique')::int as ouvertes_critiques,
  count(*) filter (where r.statut = 'ouverte' and r.gravite = 'majeure')::int as ouvertes_majeures,
  count(*) filter (where r.statut = 'ouverte' and r.gravite = 'mineure')::int as ouvertes_mineures,
  count(*) filter (where r.statut = 'ouverte' and r.gravite is null)::int as ouvertes_sans_gravite,
  count(*) filter (where r.statut = 'levee' and r.date_levee >= public.aujourdhui() - 365)::int as levees_12_mois,
  (percentile_cont(0.5) within group (order by r.date_levee - r.date_constat)
    filter (where r.statut = 'levee' and r.date_levee >= public.aujourdhui() - 365))::float8 as delai_median_levee_jours
from public.reserves r
join public.controles c on c.id = r.controle_id and c.archive_le is null
where r.archive_le is null;

create view public.v_stats_contrats with (security_invoker = true) as
select
  count(*)::int as actifs,
  coalesce(sum(c.montant_annuel), 0)::float8 as montant_annuel_total,
  count(*) filter (where c.montant_annuel is null)::int as sans_montant
from public.contrats c
where c.archive_le is null and (c.date_fin is null or c.date_fin >= public.aujourdhui());

do $$
declare v text;
begin
  foreach v in array array[
    'v_stats_mois', 'v_stats_controles_mois', 'v_stats_interventions_mois',
    'v_stats_delais_interventions', 'v_stats_reserves', 'v_stats_contrats'
  ] loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
