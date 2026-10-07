import "server-only";
import type { Tx } from "@/lib/db";
import type { StatutEcheance } from "@/lib/metier/echeance";

export type PlanEcheance = {
  plan_controle_id: string;
  type_controle_id: string;
  type_libelle: string;
  caractere: "reglementaire" | "obligatoire" | "interne";
  famille_libelle: string;
  equipement_id: string | null;
  equipement_code: string | null;
  perimetre: string | null;
  prestataire_id: string | null;
  prestataire_nom: string | null;
  periodicite_mois: number;
  dernier_controle: string | null;
  prochaine_echeance: string | null;
  statut_echeance: StatutEcheance;
  nb_reserves_ouvertes: number;
  nb_reserves_levees: number;
};

export function listerPlans(tx: Tx) {
  return tx<PlanEcheance[]>`
    select v.plan_controle_id, v.type_controle_id, v.type_libelle, v.caractere, f.libelle as famille_libelle,
      v.equipement_id, v.equipement_code, v.perimetre, v.prestataire_id, pr.nom as prestataire_nom, v.periodicite_mois,
      v.dernier_controle, v.prochaine_echeance, v.statut_echeance, v.nb_reserves_ouvertes, v.nb_reserves_levees
    from public.v_plans_controle_echeance v
    join public.familles_controle f on f.id = v.famille_id
    left join public.prestataires pr on pr.id = v.prestataire_id
    order by v.prochaine_echeance nulls first, v.type_libelle`;
}

export type PlanDetail = {
  id: string;
  type_controle_id: string;
  type_libelle: string;
  type_periodicite_mois: number;
  reference_texte: string | null;
  caractere: PlanEcheance["caractere"];
  equipement_id: string | null;
  equipement_code: string | null;
  equipement_libelle: string | null;
  perimetre_libelle: string | null;
  prestataire_id: string | null;
  prestataire_nom: string | null;
  contrat_id: string | null;
  contrat_objet: string | null;
  periodicite_mois_surcharge: number | null;
  actif: boolean;
  archive_le: Date | null;
  // Issus de la vue (null si plan inactif ou archivé)
  statut_echeance: StatutEcheance | null;
  dernier_controle: string | null;
  prochaine_echeance: string | null;
};

export async function lirePlan(tx: Tx, id: string): Promise<PlanDetail | undefined> {
  const [plan] = await tx<PlanDetail[]>`
    select p.id, p.type_controle_id, t.libelle as type_libelle, t.periodicite_mois as type_periodicite_mois,
      t.reference_texte, t.caractere, p.equipement_id, e.code as equipement_code, e.libelle as equipement_libelle,
      p.perimetre_libelle, p.prestataire_id, pr.nom as prestataire_nom, p.contrat_id, c.objet as contrat_objet,
      p.periodicite_mois_surcharge, p.actif, p.archive_le,
      v.statut_echeance, v.dernier_controle, v.prochaine_echeance
    from public.plans_controle p
    join public.types_controle t on t.id = p.type_controle_id
    left join public.equipements e on e.id = p.equipement_id
    left join public.prestataires pr on pr.id = p.prestataire_id
    left join public.contrats c on c.id = p.contrat_id
    left join public.v_plans_controle_echeance v on v.plan_controle_id = p.id
    where p.id = ${id}`;
  return plan;
}

export type ControleHistorique = {
  id: string;
  date_realisation: string;
  resultat: "conforme" | "avec_reserves" | "non_conforme";
  reference_rapport: string | null;
  commentaire: string | null;
  saisi_par: string | null;
};

export function historiqueControles(tx: Tx, planId: string) {
  return tx<ControleHistorique[]>`
    select c.id, c.date_realisation, c.resultat, c.reference_rapport, c.commentaire, pf.nom as saisi_par
    from public.controles c
    left join public.profils pf on pf.id = c.created_by
    where c.plan_controle_id = ${planId} and c.archive_le is null
    order by c.date_realisation desc, c.created_at desc`;
}

export type Reserve = {
  id: string;
  controle_id: string;
  description: string;
  gravite: "mineure" | "majeure" | "critique" | null;
  date_constat: string;
  echeance_levee: string | null;
  date_levee: string | null;
  statut: "ouverte" | "levee";
  commentaire: string | null;
};

export function reservesDuPlan(tx: Tx, planId: string) {
  return tx<Reserve[]>`
    select r.id, r.controle_id, r.description, r.gravite, r.date_constat, r.echeance_levee, r.date_levee,
      r.statut, r.commentaire
    from public.reserves r
    join public.controles c on c.id = r.controle_id and c.archive_le is null
    where c.plan_controle_id = ${planId} and r.archive_le is null
    order by (r.statut = 'levee'), r.echeance_levee nulls last, r.date_constat desc`;
}

export async function lireReserve(tx: Tx, id: string) {
  const [reserve] = await tx<(Reserve & { plan_controle_id: string; type_libelle: string })[]>`
    select r.id, r.controle_id, r.description, r.gravite, r.date_constat, r.echeance_levee, r.date_levee,
      r.statut, r.commentaire, c.plan_controle_id, t.libelle as type_libelle
    from public.reserves r
    join public.controles c on c.id = r.controle_id
    join public.plans_controle p on p.id = c.plan_controle_id
    join public.types_controle t on t.id = p.type_controle_id
    where r.id = ${id} and r.archive_le is null`;
  return reserve;
}

export type TypeControle = {
  id: string;
  libelle: string;
  famille_id: string;
  famille_libelle: string;
  caractere: PlanEcheance["caractere"];
  periodicite_mois: number;
  reference_texte: string | null;
  notes: string | null;
  nb_plans: number;
};

export function listerTypes(tx: Tx) {
  return tx<TypeControle[]>`
    select t.id, t.libelle, t.famille_id, f.libelle as famille_libelle, t.caractere, t.periodicite_mois,
      t.reference_texte, t.notes,
      (select count(*)::int from public.plans_controle p where p.type_controle_id = t.id and p.archive_le is null) as nb_plans
    from public.types_controle t
    join public.familles_controle f on f.id = t.famille_id
    where t.archive_le is null
    order by f.libelle, t.libelle`;
}

export async function lireType(tx: Tx, id: string) {
  const [type] = await tx<TypeControle[]>`
    select t.id, t.libelle, t.famille_id, f.libelle as famille_libelle, t.caractere, t.periodicite_mois,
      t.reference_texte, t.notes, 0 as nb_plans
    from public.types_controle t
    join public.familles_controle f on f.id = t.famille_id
    where t.id = ${id} and t.archive_le is null`;
  return type;
}

export type Option = { id: string; libelle: string };

export function listerFamilles(tx: Tx) {
  return tx<Option[]>`select id, libelle from public.familles_controle where archive_le is null order by libelle`;
}

/** Listes de choix du formulaire de plan. */
export async function optionsPlan(tx: Tx) {
  const [types, equipements, prestataires, contrats] = await Promise.all([
    tx<(Option & { periodicite_mois: number })[]>`
      select t.id, f.libelle || ' — ' || t.libelle as libelle, t.periodicite_mois
      from public.types_controle t join public.familles_controle f on f.id = t.famille_id
      where t.archive_le is null order by 2`,
    tx<Option[]>`
      select id, code || ' — ' || libelle as libelle from public.equipements
      where archive_le is null and statut <> 'reforme' order by code`,
    tx<Option[]>`select id, nom as libelle from public.prestataires where archive_le is null order by nom`,
    tx<Option[]>`
      select c.id, p.nom || ' — ' || c.objet as libelle
      from public.contrats c join public.prestataires p on p.id = c.prestataire_id
      where c.archive_le is null order by 2`,
  ]);
  return { types, equipements, prestataires, contrats };
}
