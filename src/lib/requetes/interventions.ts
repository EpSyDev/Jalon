import "server-only";
import type { Tx } from "@/lib/db";
import type { PRIORITES, STATUTS_CHANTIER, StatutIntervention, TYPES_INTERVENTION } from "@/lib/metier/interventions";

export type InterventionListe = {
  id: string;
  titre: string;
  type: (typeof TYPES_INTERVENTION)[number];
  statut: StatutIntervention;
  priorite: (typeof PRIORITES)[number];
  date_demande: string;
  date_prevue: string | null;
  date_cloture: string | null;
  equipement_code: string | null;
  chantier_titre: string | null;
  assignee_nom: string | null;
  prestataire_nom: string | null;
};

export function listerInterventions(tx: Tx, vue: "ouvertes" | "miennes" | "cloturees", utilisateurId: string) {
  return tx<InterventionListe[]>`
    select i.id, i.titre, i.type, i.statut, i.priorite, i.date_demande, i.date_prevue, i.date_cloture,
      e.code as equipement_code, ch.titre as chantier_titre, pf.nom as assignee_nom, pr.nom as prestataire_nom
    from public.interventions i
    left join public.equipements e on e.id = i.equipement_id
    left join public.chantiers ch on ch.id = i.chantier_id
    left join public.profils pf on pf.id = i.assignee_id
    left join public.prestataires pr on pr.id = i.prestataire_id
    where i.archive_le is null
      and case ${vue}
        when 'cloturees' then i.statut in ('terminee', 'annulee')
        when 'miennes' then i.statut not in ('terminee', 'annulee') and i.assignee_id = ${utilisateurId}
        else i.statut not in ('terminee', 'annulee')
      end
    order by i.date_cloture desc nulls last, i.date_demande desc
    limit 300`;
}

export type InterventionDetail = InterventionListe & {
  description: string | null;
  equipement_id: string | null;
  equipement_libelle: string | null;
  plan_controle_id: string | null;
  plan_libelle: string | null;
  chantier_id: string | null;
  assignee_id: string | null;
  prestataire_id: string | null;
  cree_par: string | null;
};

export async function lireIntervention(tx: Tx, id: string): Promise<InterventionDetail | undefined> {
  const [i] = await tx<InterventionDetail[]>`
    select i.id, i.titre, i.type, i.statut, i.priorite, i.date_demande, i.date_prevue, i.date_cloture, i.description,
      i.equipement_id, e.code as equipement_code, e.libelle as equipement_libelle,
      i.plan_controle_id, t.libelle as plan_libelle,
      i.chantier_id, ch.titre as chantier_titre,
      i.assignee_id, pf.nom as assignee_nom, i.prestataire_id, pr.nom as prestataire_nom, cr.nom as cree_par
    from public.interventions i
    left join public.equipements e on e.id = i.equipement_id
    left join public.plans_controle p on p.id = i.plan_controle_id
    left join public.types_controle t on t.id = p.type_controle_id
    left join public.chantiers ch on ch.id = i.chantier_id
    left join public.profils pf on pf.id = i.assignee_id
    left join public.prestataires pr on pr.id = i.prestataire_id
    left join public.profils cr on cr.id = i.created_by
    where i.id = ${id} and i.archive_le is null`;
  return i;
}

type Option = { id: string; libelle: string };

export async function optionsIntervention(tx: Tx) {
  const [equipements, plans, chantiers, intervenants, prestataires] = await Promise.all([
    tx<Option[]>`select id, code || ' — ' || libelle as libelle from public.equipements
      where archive_le is null and statut <> 'reforme' order by code`,
    tx<Option[]>`select p.id, t.libelle || coalesce(' — ' || e.code, ' — ' || p.perimetre_libelle, '') as libelle
      from public.plans_controle p join public.types_controle t on t.id = p.type_controle_id
      left join public.equipements e on e.id = p.equipement_id
      where p.archive_le is null order by 2`,
    tx<Option[]>`select id, titre as libelle from public.chantiers
      where archive_le is null and statut not in ('termine', 'annule') order by titre`,
    tx<Option[]>`select id, nom as libelle from public.profils
      where archive_le is null and role in ('admin', 'technicien') order by nom`,
    tx<Option[]>`select id, nom as libelle from public.prestataires where archive_le is null order by nom`,
  ]);
  return { equipements, plans, chantiers, intervenants, prestataires };
}

// --- Chantiers -----------------------------------------------------------------

export type Chantier = {
  id: string;
  titre: string;
  description: string | null;
  statut: (typeof STATUTS_CHANTIER)[number];
  date_debut: string | null;
  date_fin_prevue: string | null;
  date_fin_reelle: string | null;
  responsable_id: string | null;
  responsable_nom: string | null;
  notes: string | null;
  nb_ouvertes: number;
  nb_total: number;
};

const SELECT_CHANTIER = (tx: Tx) => tx`
  select ch.id, ch.titre, ch.description, ch.statut, ch.date_debut, ch.date_fin_prevue, ch.date_fin_reelle,
    ch.responsable_id, pf.nom as responsable_nom, ch.notes,
    (select count(*)::int from public.interventions i where i.chantier_id = ch.id and i.archive_le is null
      and i.statut not in ('terminee', 'annulee')) as nb_ouvertes,
    (select count(*)::int from public.interventions i where i.chantier_id = ch.id and i.archive_le is null) as nb_total
  from public.chantiers ch
  left join public.profils pf on pf.id = ch.responsable_id`;

export function listerChantiers(tx: Tx, actifsSeulement: boolean) {
  return tx<Chantier[]>`
    ${SELECT_CHANTIER(tx)}
    where ch.archive_le is null and (not ${actifsSeulement} or ch.statut in ('prevu', 'en_cours', 'suspendu'))
    order by ch.statut = 'en_cours' desc, ch.date_fin_prevue nulls last, ch.titre`;
}

export async function lireChantier(tx: Tx, id: string): Promise<Chantier | undefined> {
  const [c] = await tx<Chantier[]>`${SELECT_CHANTIER(tx)} where ch.id = ${id} and ch.archive_le is null`;
  return c;
}

export function interventionsDuChantier(tx: Tx, id: string) {
  return tx<InterventionListe[]>`
    select i.id, i.titre, i.type, i.statut, i.priorite, i.date_demande, i.date_prevue, i.date_cloture,
      e.code as equipement_code, null as chantier_titre, pf.nom as assignee_nom, pr.nom as prestataire_nom
    from public.interventions i
    left join public.equipements e on e.id = i.equipement_id
    left join public.profils pf on pf.id = i.assignee_id
    left join public.prestataires pr on pr.id = i.prestataire_id
    where i.chantier_id = ${id} and i.archive_le is null
    order by i.statut in ('terminee', 'annulee'), i.date_demande desc`;
}

export function responsablesPossibles(tx: Tx) {
  return tx<Option[]>`select id, nom as libelle from public.profils
    where archive_le is null and role in ('admin', 'technicien') order by nom`;
}
