import "server-only";
import type { Tx } from "@/lib/db";
import type { StatutEcheance } from "@/lib/metier/echeance";
import {
  filtrerEtCompter,
  STATUTS_INDISPONIBLES,
  STATUTS_RETIRES,
  statutLePlusUrgent,
  type Facettes,
  type FiltresListe,
  type LigneFiltrable,
  type StatutEquipement,
} from "@/lib/metier/parc";

export type { StatutEquipement };

const INDISPONIBLES = [...STATUTS_INDISPONIBLES];
const RETIRES = [...STATUTS_RETIRES];

export type EquipementListe = {
  id: string;
  code: string;
  libelle: string;
  statut: StatutEquipement;
  statut_depuis: string | null;
  statut_retour_prevu: string | null;
  univers: string | null;
  categorie: string | null;
  localisation: string | null;
  statuts_plans: StatutEcheance[];
  synthese: StatutEcheance | null;
};

export const PAR_PAGE = 100;

export type FiltresParc = FiltresListe & {
  q?: string;
  /** Identifiant d'univers, AUCUN (sans univers), « tous » ou absent (tout le parc). */
  univers?: string;
};

/**
 * Liste du parc : la recherche et l'univers délimitent le périmètre (SQL), puis les filtres de catégorie, de
 * localisation et de statut s'appliquent en mémoire avec leurs comptes (une seule règle, testée, pour les deux).
 */
export async function listerEquipements(
  tx: Tx,
  filtres: FiltresParc,
  /** null : toute la liste (export). */
  page: number | null = 1,
): Promise<{ equipements: EquipementListe[]; total: number; facettes: Facettes }> {
  const q = filtres.q?.trim() ? `%${filtres.q.trim()}%` : null;
  const sansUnivers = filtres.univers === "aucun";
  const univers = filtres.univers && !sansUnivers && filtres.univers !== "tous" ? filtres.univers : null;
  const perimetre = await tx<LigneFiltrable[]>`
    select e.id, e.statut, e.categorie_id, e.localisation_id
    from public.equipements e
    left join public.localisations l on l.id = e.localisation_id
    left join public.categories_equipement c on c.id = e.categorie_id
    where e.archive_le is null
      and (${univers}::uuid is null or e.univers_id = ${univers})
      and (not ${sansUnivers} or e.univers_id is null)
      and (${q}::text is null or public.normaliser(concat_ws(' ', e.code, e.libelle, e.marque, e.modele, e.numero_serie,
        l.libelle_complet, c.libelle, e.notes)) like public.normaliser(${q}))
    order by upper(substring(e.code from '^[^0-9]*')), nullif(substring(e.code from '[0-9]+'), '')::numeric nulls first,
      e.code`;
  const facettes = filtrerEtCompter(perimetre, filtres);
  const ids =
    page === null ? facettes.ids : facettes.ids.slice((Math.max(page, 1) - 1) * PAR_PAGE, Math.max(page, 1) * PAR_PAGE);
  return { equipements: await detailsListe(tx, ids), total: facettes.ids.length, facettes };
}

/** Lignes de la liste pour ces équipements, dans l'ordre donné. */
async function detailsListe(tx: Tx, ids: string[]): Promise<EquipementListe[]> {
  if (ids.length === 0) return [];
  const lignes = await tx<Omit<EquipementListe, "synthese">[]>`
    select e.id, e.code, e.libelle, e.statut, e.statut_depuis, e.statut_retour_prevu, u.libelle as univers,
      c.libelle as categorie, l.libelle_complet as localisation,
      coalesce(array_agg(v.statut_echeance) filter (where v.statut_echeance is not null), '{}') as statuts_plans
    from public.equipements e
    left join public.univers u on u.id = e.univers_id
    left join public.categories_equipement c on c.id = e.categorie_id
    left join public.localisations l on l.id = e.localisation_id
    left join public.v_plans_controle_echeance v on v.equipement_id = e.id
    where e.id = any(${ids}::uuid[])
    group by e.id, u.libelle, c.libelle, l.libelle_complet`;
  const parId = new Map(lignes.map((e) => [e.id, { ...e, synthese: statutLePlusUrgent(e.statuts_plans) }]));
  return ids.flatMap((id) => parId.get(id) ?? []);
}

export type SyntheseUnivers = {
  univers_id: string | null;
  en_parc: number;
  indisponibles: number;
  retires: number;
  en_retard: number;
};

/** Par univers (null = sans univers) : matériel en parc, indisponible, retiré, et en retard de contrôle. */
export function syntheseParUnivers(tx: Tx) {
  return tx<SyntheseUnivers[]>`
    select e.univers_id,
      count(*) filter (where e.statut <> all(${RETIRES}::text[]))::int as en_parc,
      count(*) filter (where e.statut = any(${INDISPONIBLES}::text[]))::int as indisponibles,
      count(*) filter (where e.statut = any(${RETIRES}::text[]))::int as retires,
      count(*) filter (where r.en_retard)::int as en_retard
    from public.equipements e
    left join (
      select equipement_id, bool_or(statut_echeance = 'en_retard') as en_retard
      from public.v_plans_controle_echeance where equipement_id is not null group by equipement_id
    ) r on r.equipement_id = e.id
    where e.archive_le is null
    group by e.univers_id`;
}

export type EquipementIndisponible = {
  id: string;
  code: string;
  libelle: string;
  statut: StatutEquipement;
  statut_depuis: string | null;
  statut_motif: string | null;
  statut_retour_prevu: string | null;
  prestataire: string | null;
  univers: string | null;
};

/** Matériel indisponible en ce moment, retour le plus proche (ou dépassé) en premier. */
export function materielIndisponible(tx: Tx) {
  return tx<EquipementIndisponible[]>`
    select e.id, e.code, e.libelle, e.statut, e.statut_depuis, e.statut_motif, e.statut_retour_prevu,
      p.nom as prestataire, u.libelle as univers
    from public.equipements e
    left join public.prestataires p on p.id = e.statut_prestataire_id
    left join public.univers u on u.id = e.univers_id
    where e.archive_le is null and e.statut = any(${INDISPONIBLES}::text[])
    order by e.statut_retour_prevu nulls last, e.statut_depuis nulls last, e.code
    limit 100`;
}

export type EquipementDetail = {
  id: string;
  code: string;
  libelle: string;
  univers_id: string | null;
  univers: string | null;
  categorie_id: string | null;
  categorie: string | null;
  localisation_id: string | null;
  localisation: string | null;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  date_mise_en_service: string | null;
  statut: StatutEquipement;
  statut_depuis: string | null;
  statut_motif: string | null;
  statut_prestataire_id: string | null;
  prestataire: string | null;
  statut_retour_prevu: string | null;
  qr_token: string;
  notes: string | null;
  updated_at: string;
};

export async function lireEquipement(tx: Tx, id: string): Promise<EquipementDetail | undefined> {
  const [e] = await tx<EquipementDetail[]>`
    select e.id, e.code, e.libelle, e.univers_id, u.libelle as univers, e.categorie_id, c.libelle as categorie,
      e.localisation_id, l.libelle_complet as localisation, e.marque, e.modele, e.numero_serie, e.date_mise_en_service,
      e.statut, e.statut_depuis, e.statut_motif, e.statut_prestataire_id, p.nom as prestataire, e.statut_retour_prevu,
      e.qr_token, e.notes, e.updated_at::text as updated_at
    from public.equipements e
    left join public.univers u on u.id = e.univers_id
    left join public.categories_equipement c on c.id = e.categorie_id
    left join public.localisations l on l.id = e.localisation_id
    left join public.prestataires p on p.id = e.statut_prestataire_id
    where e.id = ${id} and e.archive_le is null`;
  return e;
}

export async function idParQrToken(tx: Tx, token: string): Promise<string | undefined> {
  const [e] = await tx<{ id: string }[]>`
    select id from public.equipements where qr_token = ${token} and archive_le is null`;
  return e?.id;
}

export async function ficheEquipement(tx: Tx, id: string) {
  const [plans, controles, interventions] = await Promise.all([
    tx<
      {
        plan_controle_id: string;
        type_libelle: string;
        statut_echeance: StatutEcheance;
        prochaine_echeance: string | null;
        nb_reserves_ouvertes: number;
      }[]
    >`
      select plan_controle_id, type_libelle, statut_echeance, prochaine_echeance, nb_reserves_ouvertes
      from public.v_plans_controle_echeance where equipement_id = ${id}
      order by prochaine_echeance nulls first`,
    tx<{ id: string; plan_controle_id: string; type_libelle: string; date_realisation: string; resultat: string }[]>`
      select c.id, c.plan_controle_id, t.libelle as type_libelle, c.date_realisation, c.resultat
      from public.controles c
      join public.plans_controle p on p.id = c.plan_controle_id
      join public.types_controle t on t.id = p.type_controle_id
      where p.equipement_id = ${id} and c.archive_le is null
      order by c.date_realisation desc limit 20`,
    tx<{ id: string; titre: string; statut: string; priorite: string; date_demande: string }[]>`
      select id, titre, statut, priorite, date_demande from public.interventions
      where archive_le is null
        and (equipement_id = ${id}
          or plan_controle_id in (select p.id from public.plans_controle p where p.equipement_id = ${id}))
      order by (statut in ('terminee', 'annulee')), date_demande desc limit 20`,
  ]);
  return { plans, controles, interventions };
}

export type Localisation = {
  id: string;
  batiment: string;
  niveau: string | null;
  local: string | null;
  libelle_complet: string;
  nb_equipements: number;
};

export function listerLocalisations(tx: Tx) {
  return tx<Localisation[]>`
    select l.id, l.batiment, l.niveau, l.local, l.libelle_complet,
      (select count(*)::int from public.equipements e where e.localisation_id = l.id and e.archive_le is null)
        as nb_equipements
    from public.localisations l where l.archive_le is null
    order by l.batiment, l.niveau nulls first, l.local nulls first`;
}

export type UniversListe = { id: string; libelle: string; description: string | null; nb_equipements: number };

export function listerUnivers(tx: Tx) {
  return tx<UniversListe[]>`
    select u.id, u.libelle, u.description,
      (select count(*)::int from public.equipements e where e.univers_id = u.id and e.archive_le is null) as nb_equipements
    from public.univers u where u.archive_le is null order by u.libelle`;
}

export type CategorieListe = { id: string; libelle: string; univers_id: string | null; nb_equipements: number };

/** Catégories actives (null = transversale, sans univers), avec leur nombre d'équipements. */
export function listerCategories(tx: Tx) {
  return tx<CategorieListe[]>`
    select c.id, c.libelle, c.univers_id,
      (select count(*)::int from public.equipements e where e.categorie_id = c.id and e.archive_le is null)
        as nb_equipements
    from public.categories_equipement c where c.archive_le is null
    order by public.normaliser(c.libelle)`;
}

export type OptionsEquipement = {
  univers: { id: string; libelle: string }[];
  categories: { id: string; libelle: string; univers_id: string | null }[];
  localisations: { id: string; libelle: string }[];
  prestataires: { id: string; libelle: string }[];
};

export async function optionsEquipement(tx: Tx): Promise<OptionsEquipement> {
  const [univers, categories, localisations, prestataires] = await Promise.all([
    tx<{ id: string; libelle: string }[]>`
      select id, libelle from public.univers where archive_le is null order by libelle`,
    tx<{ id: string; libelle: string; univers_id: string | null }[]>`
      select id, libelle, univers_id from public.categories_equipement where archive_le is null
      order by public.normaliser(libelle)`,
    tx<{ id: string; libelle: string }[]>`
      select id, libelle_complet as libelle from public.localisations where archive_le is null order by 2`,
    tx<{ id: string; libelle: string }[]>`
      select id, nom as libelle from public.prestataires where archive_le is null order by nom`,
  ]);
  return { univers, categories, localisations, prestataires };
}

/**
 * Catégorie désignée par son nom dans un univers : retrouvée (accents et casse ignorés) ou créée.
 * Une catégorie transversale du même nom convient aussi.
 */
export async function categorieParNom(tx: Tx, libelle: string, universId: string | null): Promise<string> {
  const [trouvee] = await tx<{ id: string }[]>`
    select id from public.categories_equipement
    where archive_le is null and public.normaliser(libelle) = public.normaliser(${libelle})
      and (univers_id is null or univers_id is not distinct from ${universId}::uuid)
    order by univers_id nulls last limit 1`;
  if (trouvee) return trouvee.id;
  const [creee] = await tx<{ id: string }[]>`
    insert into public.categories_equipement (libelle, univers_id) values (${libelle}, ${universId}) returning id`;
  return creee.id;
}

/**
 * Modification groupée. Un changement de statut efface les précisions de l'ancien (motif, prestataire, retour) ;
 * un changement d'univers sans catégorie choisie retire la catégorie propre à un autre univers.
 */
export async function modifierEnMasse(
  tx: Tx,
  ids: string[],
  m: { univers_id?: string | null; categorie_id?: string | null; localisation_id?: string | null; statut?: string },
): Promise<number> {
  const champs: Record<string, unknown> = { ...m };
  if (m.statut) Object.assign(champs, { statut_motif: null, statut_prestataire_id: null, statut_retour_prevu: null });
  const retirerCategorie = m.univers_id !== undefined && m.categorie_id === undefined;
  const lignes = await tx`
    update public.equipements e set ${tx(champs)}
      ${
        retirerCategorie
          ? tx`, categorie_id = case when exists (
              select 1 from public.categories_equipement c
              where c.id = e.categorie_id and c.univers_id is not null and c.univers_id is distinct from ${m.univers_id ?? null}::uuid
            ) then null else e.categorie_id end`
          : tx``
      }
    where e.id = any(${ids}::uuid[]) and e.archive_le is null
    returning e.id`;
  return lignes.length;
}

export type Etiquette = {
  id: string;
  code: string;
  libelle: string;
  localisation: string | null;
  qr_token: string;
  univers: string | null;
  categorie: string | null;
};

/**
 * Équipements à étiqueter (QR), hors matériel retiré du parc : par identifiants, par univers (AUCUN : sans univers)
 * et catégorie, ou tout le parc. Rangés par univers, catégorie puis code.
 */
export function equipementsAEtiqueter(
  tx: Tx,
  filtre: { ids?: string[] | null; univers?: string; categorie?: string } = {},
) {
  const ids = filtre.ids?.length ? filtre.ids : null;
  const sansUnivers = filtre.univers === "aucun";
  const univers = filtre.univers && !sansUnivers && filtre.univers !== "tous" ? filtre.univers : null;
  const sansCategorie = filtre.categorie === "aucun";
  const categorie = filtre.categorie && !sansCategorie ? filtre.categorie : null;
  return tx<Etiquette[]>`
    select e.id, e.code, e.libelle, l.libelle_complet as localisation, e.qr_token, u.libelle as univers,
      c.libelle as categorie
    from public.equipements e
    left join public.localisations l on l.id = e.localisation_id
    left join public.univers u on u.id = e.univers_id
    left join public.categories_equipement c on c.id = e.categorie_id
    where e.archive_le is null and e.statut <> all(${RETIRES}::text[])
      and (${ids}::uuid[] is null or e.id = any(${ids}::uuid[]))
      and (${univers}::uuid is null or e.univers_id = ${univers})
      and (not ${sansUnivers} or e.univers_id is null)
      and (${categorie}::uuid is null or e.categorie_id = ${categorie})
      and (not ${sansCategorie} or e.categorie_id is null)
    order by u.libelle nulls last, public.normaliser(c.libelle) nulls last,
      upper(substring(e.code from '^[^0-9]*')), nullif(substring(e.code from '[0-9]+'), '')::numeric nulls first, e.code`;
}
