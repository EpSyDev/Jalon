import "server-only";
import type { Tx } from "@/lib/db";
import { listerPlans } from "@/lib/requetes/controles";

export type ReserveOuverte = {
  id: string;
  description: string;
  gravite: "mineure" | "majeure" | "critique" | null;
  echeance_levee: string | null;
  plan_controle_id: string;
  type_libelle: string;
  perimetre: string | null;
};

export type InterventionOuverte = {
  id: string;
  titre: string;
  statut: "a_faire" | "en_cours" | "en_attente";
  priorite: "basse" | "normale" | "haute" | "urgente";
  date_prevue: string | null;
  date_demande: string;
  equipement_code: string | null;
  assignee_nom: string | null;
};

export type ChantierSuivi = {
  id: string;
  titre: string;
  statut: "prevu" | "en_cours" | "suspendu";
  date_debut: string | null;
  date_fin_prevue: string | null;
  responsable_nom: string | null;
};

export type ContratSuivi = {
  id: string;
  objet: string;
  prestataire_nom: string;
  date_fin: string;
  preavis_jours: number | null;
  reconduction_tacite: boolean;
};

/** Toutes les données de l'écran « Aujourd'hui », en une transaction. */
export async function donneesAujourdhui(tx: Tx) {
  const [plans, reserves, interventions, chantiers, contrats, [seuil]] = await Promise.all([
    listerPlans(tx),
    tx<ReserveOuverte[]>`
      select r.id, r.description, r.gravite, r.echeance_levee, p.id as plan_controle_id, t.libelle as type_libelle,
        coalesce(p.perimetre_libelle, e.code) as perimetre
      from public.reserves r
      join public.controles c on c.id = r.controle_id and c.archive_le is null
      join public.plans_controle p on p.id = c.plan_controle_id and p.archive_le is null
      join public.types_controle t on t.id = p.type_controle_id
      left join public.equipements e on e.id = p.equipement_id
      where r.statut = 'ouverte' and r.archive_le is null
      order by r.echeance_levee nulls last, r.date_constat`,
    // Toutes les interventions non terminées : urgentes et en retard sont triées côté TypeScript (metier/retards).
    tx<InterventionOuverte[]>`
      select i.id, i.titre, i.statut, i.priorite, i.date_prevue, i.date_demande, e.code as equipement_code, pf.nom as assignee_nom
      from public.interventions i
      left join public.equipements e on e.id = i.equipement_id
      left join public.profils pf on pf.id = i.assignee_id
      where i.statut not in ('terminee', 'annulee') and i.archive_le is null
      order by i.date_demande`,
    tx<ChantierSuivi[]>`
      select c.id, c.titre, c.statut, c.date_debut, c.date_fin_prevue, pf.nom as responsable_nom
      from public.chantiers c left join public.profils pf on pf.id = c.responsable_id
      where c.statut in ('prevu', 'en_cours', 'suspendu') and c.archive_le is null
      order by c.date_fin_prevue nulls last`,
    tx<ContratSuivi[]>`
      select c.id, c.objet, p.nom as prestataire_nom, c.date_fin, c.preavis_jours, c.reconduction_tacite
      from public.contrats c
      join public.prestataires p on p.id = c.prestataire_id
      where c.date_fin is not null and c.archive_le is null
      order by c.date_fin`,
    tx<{ jours: number; destinataires: number }[]>`
      select
        coalesce((select (valeur #>> '{}')::int from public.parametres where cle = 'seuil_a_echeance_jours'), 60) as jours,
        coalesce((select jsonb_array_length(valeur) from public.parametres
          where cle = 'destinataires_rappels' and jsonb_typeof(valeur) = 'array'), 0) as destinataires`,
  ]);
  return {
    plans,
    reserves,
    interventions,
    chantiers,
    contrats,
    seuilJours: seuil.jours,
    destinataires: seuil.destinataires,
  };
}
