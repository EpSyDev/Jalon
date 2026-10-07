import "server-only";
import type { Tx } from "@/lib/db";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { trousDuSuivi, type EntreeVerifications } from "@/lib/metier/verifications";
import { listerPlans } from "@/lib/requetes/controles";

/** Trous dans le suivi (voir metier/verifications). plans : déjà lus par l'appelant, sinon relus ici. */
export async function verifications(tx: Tx, plansLus?: EntreeVerifications["plans"]) {
  const [plans, reservesADetailler, contratsSansFin, equipementsSansPlan] = await Promise.all([
    plansLus ?? listerPlans(tx),
    tx<EntreeVerifications["reservesADetailler"]>`
      select r.id, t.libelle as type_libelle, c.plan_controle_id, r.date_constat
      from public.reserves r
      join public.controles c on c.id = r.controle_id and c.archive_le is null
      join public.plans_controle p on p.id = c.plan_controle_id and p.archive_le is null
      join public.types_controle t on t.id = p.type_controle_id
      where r.statut = 'ouverte' and r.archive_le is null and r.description like 'À détailler%'
      order by r.date_constat`,
    tx<EntreeVerifications["contratsSansFin"]>`
      select c.id, c.objet, p.nom as prestataire_nom
      from public.contrats c join public.prestataires p on p.id = c.prestataire_id
      where c.archive_le is null and c.date_fin is null
      order by c.objet`,
    tx<EntreeVerifications["equipementsSansPlan"]>`
      select e.id, e.code, e.libelle from public.equipements e
      where e.archive_le is null and e.statut = 'en_service'
        and not exists (select 1 from public.v_plans_controle_echeance v where v.equipement_id = e.id)
      order by e.code`,
  ]);
  return trousDuSuivi({
    aujourdhui: aujourdhuiParis(),
    plans,
    reservesADetailler,
    contratsSansFin,
    equipementsSansPlan,
  });
}
