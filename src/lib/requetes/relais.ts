import "server-only";
import type { Tx } from "@/lib/db";

export type InterventionOuverte = {
  id: string;
  titre: string;
  statut: "a_faire" | "en_cours" | "en_attente";
  priorite: "basse" | "normale" | "haute" | "urgente";
  date_demande: string;
  equipement_code: string | null;
  prestataire_nom: string | null;
};

export type PrestataireCle = {
  id: string;
  nom: string;
  contact_nom: string | null;
  telephone: string | null;
  email: string | null;
  nb_plans: number;
  nb_contrats: number;
};

/** Compléments de la fiche « passage de relais » (le reste vient de l'écran Aujourd'hui). */
export async function donneesRelais(tx: Tx) {
  const [interventions, prestataires] = await Promise.all([
    tx<InterventionOuverte[]>`
      select i.id, i.titre, i.statut, i.priorite, i.date_demande, e.code as equipement_code, p.nom as prestataire_nom
      from public.interventions i
      left join public.equipements e on e.id = i.equipement_id
      left join public.prestataires p on p.id = i.prestataire_id
      where i.archive_le is null and i.statut not in ('terminee', 'annulee')
      order by case i.priorite when 'urgente' then 0 when 'haute' then 1 when 'normale' then 2 else 3 end, i.date_demande`,
    // Prestataires qui portent au moins un plan actif ou un contrat en cours.
    tx<PrestataireCle[]>`
      select p.id, p.nom, p.contact_nom, p.telephone, p.email,
        (select count(*)::int from public.v_plans_controle_echeance v where v.prestataire_id = p.id) as nb_plans,
        (select count(*)::int from public.contrats c where c.prestataire_id = p.id and c.archive_le is null
          and (c.date_fin is null or c.date_fin >= public.aujourdhui())) as nb_contrats
      from public.prestataires p
      where p.archive_le is null
      order by p.nom`,
  ]);
  return { interventions, prestataires: prestataires.filter((p) => p.nb_plans + p.nb_contrats > 0) };
}
