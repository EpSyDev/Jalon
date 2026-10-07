import "server-only";
import type { Tx } from "@/lib/db";
import { horsSeuil, statutReleve, type StatutReleve } from "@/lib/metier/releves";

export type PointReleve = {
  id: string;
  libelle: string;
  unite: string | null;
  equipement_id: string | null;
  equipement_code: string | null;
  localisation_id: string | null;
  localisation: string | null;
  periodicite_jours: number;
  seuil_min: number | null;
  seuil_max: number | null;
  notes: string | null;
  actif: boolean;
  dernier_releve: string | null;
  derniere_valeur: number | null;
};

export type PointAvecEtat = PointReleve & { statut: StatutReleve; hors_seuil: "bas" | "haut" | null };

const COLONNES = `p.id, p.libelle, p.unite, p.equipement_id, e.code as equipement_code, p.localisation_id,
  l.libelle_complet as localisation, p.periodicite_jours, p.seuil_min::float8 as seuil_min,
  p.seuil_max::float8 as seuil_max, p.notes, p.actif, d.date_releve as dernier_releve, d.valeur::float8 as derniere_valeur`;

const JOINTURES = `
  left join public.equipements e on e.id = p.equipement_id
  left join public.localisations l on l.id = p.localisation_id
  left join lateral (
    select r.date_releve, r.valeur from public.releves r
    where r.point_id = p.id and r.archive_le is null
    order by r.date_releve desc, r.created_at desc limit 1
  ) d on true`;

export function avecEtat(p: PointReleve, aujourdhui: string): PointAvecEtat {
  return {
    ...p,
    statut: statutReleve(p.dernier_releve, p.periodicite_jours, aujourdhui),
    hors_seuil: p.derniere_valeur === null ? null : horsSeuil(p.derniere_valeur, p.seuil_min, p.seuil_max),
  };
}

/** Points actifs ou non, avec leur dernier relevé. L'état (retard, seuil) est calculé par l'appelant. */
export function listerPoints(tx: Tx, actifsSeulement: boolean) {
  return tx<PointReleve[]>`
    select ${tx.unsafe(COLONNES)} from public.points_releve p ${tx.unsafe(JOINTURES)}
    where p.archive_le is null and (${actifsSeulement} = false or p.actif)
    order by p.libelle`;
}

export async function lirePoint(tx: Tx, id: string): Promise<PointReleve | undefined> {
  const [p] = await tx<PointReleve[]>`
    select ${tx.unsafe(COLONNES)} from public.points_releve p ${tx.unsafe(JOINTURES)}
    where p.id = ${id} and p.archive_le is null`;
  return p;
}

export type ReleveHistorique = {
  id: string;
  date_releve: string;
  valeur: number;
  commentaire: string | null;
  saisi_par: string | null;
};

export function historiqueReleves(tx: Tx, pointId: string, limite = 100) {
  return tx<ReleveHistorique[]>`
    select r.id, r.date_releve, r.valeur::float8 as valeur, r.commentaire, pf.nom as saisi_par
    from public.releves r left join public.profils pf on pf.id = r.created_by
    where r.point_id = ${pointId} and r.archive_le is null
    order by r.date_releve desc, r.created_at desc limit ${limite}`;
}

export async function optionsPoint(tx: Tx) {
  const [equipements, localisations] = await Promise.all([
    tx<{ id: string; libelle: string }[]>`
      select id, code || ' — ' || libelle as libelle from public.equipements
      where archive_le is null and statut <> 'reforme' order by code`,
    tx<{ id: string; libelle: string }[]>`
      select id, libelle_complet as libelle from public.localisations where archive_le is null order by 2`,
  ]);
  return { equipements, localisations };
}
