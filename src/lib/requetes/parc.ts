import "server-only";
import type { Tx } from "@/lib/db";
import type { StatutEcheance } from "@/lib/metier/echeance";
import { statutLePlusUrgent } from "@/lib/metier/parc";

export type StatutEquipement = "en_service" | "hors_service" | "reforme";

export type EquipementListe = {
  id: string;
  code: string;
  libelle: string;
  statut: StatutEquipement;
  famille: string | null;
  univers: string | null;
  localisation: string | null;
  statuts_plans: StatutEcheance[];
  synthese: StatutEcheance | null;
};

export async function listerEquipements(
  tx: Tx,
  filtres: { q?: string; statut?: string; famille?: string; univers?: string },
): Promise<EquipementListe[]> {
  const q = filtres.q?.trim() ? `%${filtres.q.trim()}%` : null;
  const lignes = await tx<Omit<EquipementListe, "synthese">[]>`
    select e.id, e.code, e.libelle, e.statut, f.libelle as famille, u.libelle as univers, l.libelle_complet as localisation,
      coalesce(array_agg(v.statut_echeance) filter (where v.statut_echeance is not null), '{}') as statuts_plans
    from public.equipements e
    left join public.familles_controle f on f.id = e.famille_id
    left join public.univers u on u.id = e.univers_id
    left join public.localisations l on l.id = e.localisation_id
    left join public.v_plans_controle_echeance v on v.equipement_id = e.id
    where e.archive_le is null
      and (${filtres.statut ?? null}::text is null or e.statut = ${filtres.statut ?? null})
      and (${filtres.famille ?? null}::uuid is null or e.famille_id = ${filtres.famille ?? null})
      and (${filtres.univers === "aucun" ? "aucun" : null}::text is null or e.univers_id is null)
      and (${filtres.univers && filtres.univers !== "aucun" ? filtres.univers : null}::uuid is null
        or e.univers_id = ${filtres.univers && filtres.univers !== "aucun" ? filtres.univers : null})
      and (${q}::text is null or public.normaliser(e.code || ' ' || e.libelle || ' ' || coalesce(l.libelle_complet, ''))
        like public.normaliser(${q}))
    group by e.id, f.libelle, u.libelle, l.libelle_complet
    order by e.code`;
  return lignes.map((e) => ({ ...e, synthese: statutLePlusUrgent(e.statuts_plans) }));
}

export type EquipementDetail = {
  id: string;
  code: string;
  libelle: string;
  univers_id: string | null;
  univers: string | null;
  famille_id: string | null;
  famille: string | null;
  localisation_id: string | null;
  localisation: string | null;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
  date_mise_en_service: string | null;
  statut: StatutEquipement;
  qr_token: string;
  notes: string | null;
};

export async function lireEquipement(tx: Tx, id: string): Promise<EquipementDetail | undefined> {
  const [e] = await tx<EquipementDetail[]>`
    select e.id, e.code, e.libelle, e.univers_id, u.libelle as univers, e.famille_id, f.libelle as famille, e.localisation_id,
      l.libelle_complet as localisation, e.marque, e.modele, e.numero_serie, e.date_mise_en_service, e.statut,
      e.qr_token, e.notes
    from public.equipements e
    left join public.familles_controle f on f.id = e.famille_id
    left join public.univers u on u.id = e.univers_id
    left join public.localisations l on l.id = e.localisation_id
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
      where equipement_id = ${id} and archive_le is null
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

export async function optionsEquipement(tx: Tx) {
  const [univers, familles, localisations] = await Promise.all([
    tx<{ id: string; libelle: string }[]>`
      select id, libelle from public.univers where archive_le is null order by libelle`,
    tx<{ id: string; libelle: string }[]>`
      select id, libelle from public.familles_controle where archive_le is null order by libelle`,
    tx<{ id: string; libelle: string }[]>`
      select id, libelle_complet as libelle from public.localisations where archive_le is null order by 2`,
  ]);
  return { univers, familles, localisations };
}

/** Équipements à étiqueter (QR), filtrés par identifiants ou tous les actifs. */
export function equipementsAEtiqueter(tx: Tx, ids: string[] | null) {
  return tx<{ id: string; code: string; libelle: string; localisation: string | null; qr_token: string }[]>`
    select e.id, e.code, e.libelle, l.libelle_complet as localisation, e.qr_token
    from public.equipements e
    left join public.localisations l on l.id = e.localisation_id
    where e.archive_le is null and e.statut <> 'reforme'
      and (${ids}::uuid[] is null or e.id = any(${ids}::uuid[]))
    order by e.code`;
}
