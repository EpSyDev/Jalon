import "server-only";
import type { Tx } from "@/lib/db";

export type Prestataire = {
  id: string;
  nom: string;
  contact_nom: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
  nb_contrats: number;
  nb_plans: number;
  nb_interventions_ouvertes: number;
};

const SELECT_PRESTATAIRE = (tx: Tx) => tx`
  select p.id, p.nom, p.contact_nom, p.email, p.telephone, p.notes,
    (select count(*)::int from public.contrats c where c.prestataire_id = p.id and c.archive_le is null) as nb_contrats,
    (select count(*)::int from public.plans_controle pl where pl.prestataire_id = p.id and pl.archive_le is null) as nb_plans,
    (select count(*)::int from public.interventions i where i.prestataire_id = p.id and i.archive_le is null
      and i.statut not in ('terminee', 'annulee')) as nb_interventions_ouvertes
  from public.prestataires p`;

export function listerPrestataires(tx: Tx) {
  return tx<Prestataire[]>`${SELECT_PRESTATAIRE(tx)} where p.archive_le is null order by p.nom`;
}

export async function lirePrestataire(tx: Tx, id: string): Promise<Prestataire | undefined> {
  const [p] = await tx<Prestataire[]>`${SELECT_PRESTATAIRE(tx)} where p.id = ${id} and p.archive_le is null`;
  return p;
}

export function plansDuPrestataire(tx: Tx, id: string) {
  return tx<
    {
      plan_controle_id: string;
      type_libelle: string;
      perimetre: string | null;
      statut_echeance: string;
      prochaine_echeance: string | null;
    }[]
  >`
    select plan_controle_id, type_libelle, coalesce(equipement_code, perimetre) as perimetre, statut_echeance,
      prochaine_echeance
    from public.v_plans_controle_echeance where prestataire_id = ${id}
    order by prochaine_echeance nulls first`;
}

export type Contrat = {
  id: string;
  prestataire_id: string;
  prestataire_nom: string;
  objet: string;
  reference: string | null;
  date_debut: string | null;
  date_fin: string | null;
  reconduction_tacite: boolean;
  preavis_jours: number | null;
  montant_annuel: string | null;
  reference_document: string | null;
  notes: string | null;
  nb_plans: number;
};

const SELECT_CONTRAT = (tx: Tx) => tx`
  select c.id, c.prestataire_id, p.nom as prestataire_nom, c.objet, c.reference, c.date_debut, c.date_fin,
    c.reconduction_tacite, c.preavis_jours, c.montant_annuel::text as montant_annuel, c.reference_document, c.notes,
    (select count(*)::int from public.plans_controle pl where pl.contrat_id = c.id and pl.archive_le is null) as nb_plans
  from public.contrats c
  join public.prestataires p on p.id = c.prestataire_id`;

export function listerContrats(tx: Tx, prestataireId?: string) {
  return tx<Contrat[]>`${SELECT_CONTRAT(tx)}
    where c.archive_le is null and (${prestataireId ?? null}::uuid is null or c.prestataire_id = ${prestataireId ?? null})
    order by c.date_fin nulls last, c.objet`;
}

export async function lireContrat(tx: Tx, id: string): Promise<Contrat | undefined> {
  const [c] = await tx<Contrat[]>`${SELECT_CONTRAT(tx)} where c.id = ${id} and c.archive_le is null`;
  return c;
}

export function plansDuContrat(tx: Tx, id: string) {
  return tx<{ id: string; libelle: string }[]>`
    select p.id, t.libelle || coalesce(' — ' || e.code, ' — ' || p.perimetre_libelle, '') as libelle
    from public.plans_controle p join public.types_controle t on t.id = p.type_controle_id
    left join public.equipements e on e.id = p.equipement_id
    where p.contrat_id = ${id} and p.archive_le is null order by 2`;
}

export function optionsPrestataires(tx: Tx) {
  return tx<{ id: string; libelle: string }[]>`
    select id, nom as libelle from public.prestataires where archive_le is null order by nom`;
}

export async function seuilAEcheance(tx: Tx): Promise<number> {
  const [r] = await tx<{ jours: number }[]>`
    select coalesce((select (valeur #>> '{}')::int from public.parametres where cle = 'seuil_a_echeance_jours'), 60)
      as jours`;
  return r.jours;
}
