-- Calcul des échéances : jamais stocké, toujours calculé.
-- Miroir exact de src/lib/metier/echeance.ts (test de parité automatique).

-- date + n mois, fin de mois gérée (31/01 + 1 mois = 28 ou 29/02), comme date-fns addMonths.
create function public.prochaine_echeance(dernier_controle date, periodicite_mois integer) returns date
language sql immutable
set search_path = ''
as $$ select (dernier_controle + make_interval(months => periodicite_mois))::date $$;

create function public.statut_echeance(echeance date, aujourdhui date, seuil_jours integer) returns text
language sql immutable
set search_path = ''
as $$
  select case
    when echeance is null then 'jamais_controle'
    when echeance < aujourdhui then 'en_retard'
    when echeance <= aujourdhui + seuil_jours then 'a_echeance'
    else 'a_jour'
  end
$$;

-- security_invoker : la vue applique la RLS de l'utilisateur appelant.
create view public.v_plans_controle_echeance with (security_invoker = true) as
with dernier as (
  select c.plan_controle_id, max(c.date_realisation) as dernier_controle
  from public.controles c
  where c.archive_le is null
  group by c.plan_controle_id
),
res as (
  select c.plan_controle_id,
    count(*) filter (where r.statut = 'ouverte') as nb_reserves_ouvertes,
    count(*) filter (where r.statut = 'levee') as nb_reserves_levees
  from public.reserves r
  join public.controles c on c.id = r.controle_id and c.archive_le is null
  where r.archive_le is null
  group by c.plan_controle_id
),
seuil as (
  select coalesce((select (valeur #>> '{}')::integer from public.parametres where cle = 'seuil_a_echeance_jours'), 60) as jours
),
base as (
  select
    p.id as plan_controle_id,
    p.type_controle_id,
    t.libelle as type_libelle,
    t.caractere,
    t.famille_id,
    p.equipement_id,
    e.code as equipement_code,
    coalesce(p.perimetre_libelle, e.libelle) as perimetre,
    p.prestataire_id,
    coalesce(p.periodicite_mois_surcharge, t.periodicite_mois) as periodicite_mois,
    d.dernier_controle,
    public.prochaine_echeance(d.dernier_controle, coalesce(p.periodicite_mois_surcharge, t.periodicite_mois)) as prochaine_echeance,
    coalesce(r.nb_reserves_ouvertes, 0)::integer as nb_reserves_ouvertes,
    coalesce(r.nb_reserves_levees, 0)::integer as nb_reserves_levees
  from public.plans_controle p
  join public.types_controle t on t.id = p.type_controle_id and t.archive_le is null
  left join public.equipements e on e.id = p.equipement_id
  left join dernier d on d.plan_controle_id = p.id
  left join res r on r.plan_controle_id = p.id
  where p.actif
    and p.archive_le is null
    and (p.equipement_id is null or (e.archive_le is null and e.statut <> 'reforme'))
)
select
  b.*,
  public.statut_echeance(b.prochaine_echeance, public.aujourdhui(), s.jours) as statut_echeance,
  b.nb_reserves_ouvertes > 0 as reserves_ouvertes
from base b cross join seuil s;

revoke all on public.v_plans_controle_echeance from anon;
grant select on public.v_plans_controle_echeance to authenticated;
