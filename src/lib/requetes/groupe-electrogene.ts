import "server-only";
import type { Tx } from "@/lib/db";
import { normaliser } from "@/lib/metier/import";
import { listerPlans, type PlanEcheance } from "@/lib/requetes/controles";

/** Famille de contrôles du groupe électrogène : les plans de cette famille sont suivis sur la page dédiée. */
export const FAMILLE_GROUPE = "Groupe électrogène";
export const TYPE_ESSAI = "Essai en charge mensuel";

/** Plans de contrôle du groupe électrogène (famille « Groupe électrogène », accents et casse ignorés). */
export async function plansGroupe(tx: Tx): Promise<PlanEcheance[]> {
  const cle = normaliser(FAMILLE_GROUPE);
  return (await listerPlans(tx)).filter((p) => normaliser(p.famille_libelle) === cle);
}

export type EssaiFait = {
  id: string;
  plan_controle_id: string;
  perimetre: string;
  date_realisation: string;
  resultat: "conforme" | "avec_reserves" | "non_conforme";
  commentaire: string | null;
};

/** Derniers essais réalisés, tous groupes confondus. */
export function derniersEssais(tx: Tx, planIds: string[], limite = 12) {
  if (planIds.length === 0) return Promise.resolve([] as EssaiFait[]);
  return tx<EssaiFait[]>`
    select c.id, c.plan_controle_id, coalesce(e.code || ' — ' || e.libelle, p.perimetre_libelle, '') as perimetre,
      c.date_realisation, c.resultat, c.commentaire
    from public.controles c
    join public.plans_controle p on p.id = c.plan_controle_id
    left join public.equipements e on e.id = p.equipement_id
    where c.plan_controle_id = any(${planIds}::uuid[]) and c.archive_le is null
    order by c.date_realisation desc, c.created_at desc
    limit ${limite}`;
}

export type EpiListe = {
  id: string;
  libelle: string;
  detail: string | null;
  quantite: number;
  date_peremption: string | null;
  localisation_id: string | null;
  localisation: string | null;
  notes: string | null;
};

const COLONNES = `x.id, x.libelle, x.detail, x.quantite, x.date_peremption, x.localisation_id,
  l.libelle_complet as localisation, x.notes`;

/** EPI actifs : périmés et prochaines péremptions d'abord, ceux sans date en dernier. */
export function listerEpi(tx: Tx) {
  return tx<EpiListe[]>`
    select ${tx.unsafe(COLONNES)}
    from public.epi x left join public.localisations l on l.id = x.localisation_id
    where x.archive_le is null
    order by x.date_peremption nulls last, public.normaliser(x.libelle)`;
}

export async function lireEpi(tx: Tx, id: string): Promise<EpiListe | undefined> {
  const [x] = await tx<EpiListe[]>`
    select ${tx.unsafe(COLONNES)}
    from public.epi x left join public.localisations l on l.id = x.localisation_id
    where x.id = ${id} and x.archive_le is null`;
  return x;
}

export async function optionsGroupe(tx: Tx) {
  const [equipements, localisations] = await Promise.all([
    tx<{ id: string; libelle: string }[]>`
      select id, code || ' — ' || libelle as libelle from public.equipements
      where archive_le is null and statut not in ('reforme', 'declasse') order by code`,
    tx<{ id: string; libelle: string }[]>`
      select id, libelle_complet as libelle from public.localisations where archive_le is null order by 2`,
  ]);
  return { equipements, localisations };
}
