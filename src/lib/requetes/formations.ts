import "server-only";
import type { Tx } from "@/lib/db";

export type FormationEtat = {
  id: string;
  agent_id: string;
  agent_nom: string;
  type_formation_id: string;
  type_libelle: string;
  date_formation: string;
  duree_heures: number | null;
  organisme: string | null;
  echeance: string | null;
  notes: string | null;
};

const COLONNES = `f.id, f.agent_id, a.nom as agent_nom, f.type_formation_id, t.libelle as type_libelle,
  f.date_formation::text as date_formation, f.duree_heures::float8 as duree_heures, f.organisme,
  f.echeance::text as echeance, f.notes`;

/** Dernière formation déjà suivie par agent et par type (c'est elle qui fixe l'état de validité ; les sessions à venir sont à part). */
export async function formationsActuelles(tx: Tx, aujourdhui: string): Promise<FormationEtat[]> {
  const lignes = await tx<FormationEtat[]>`
    select distinct on (f.agent_id, f.type_formation_id) ${tx.unsafe(COLONNES)}
    from public.formations f
    join public.agents a on a.id = f.agent_id and a.archive_le is null
    join public.types_formation t on t.id = f.type_formation_id and t.archive_le is null
    where f.archive_le is null and f.date_formation <= ${aujourdhui}::date
    order by f.agent_id, f.type_formation_id, f.date_formation desc, f.created_at desc`;
  return [...lignes].sort(
    (x, y) =>
      (x.echeance ?? "9999").localeCompare(y.echeance ?? "9999") ||
      x.agent_nom.localeCompare(y.agent_nom, "fr") ||
      x.type_libelle.localeCompare(y.type_libelle, "fr"),
  );
}

export async function lireFormation(tx: Tx, id: string): Promise<FormationEtat | undefined> {
  const [f] = await tx<FormationEtat[]>`
    select ${tx.unsafe(COLONNES)}
    from public.formations f
    join public.agents a on a.id = f.agent_id
    join public.types_formation t on t.id = f.type_formation_id
    where f.id = ${id} and f.archive_le is null`;
  return f;
}

/** Historique complet d'un agent pour un type (la plus récente d'abord). */
export function historiqueFormation(tx: Tx, agentId: string, typeId: string) {
  return tx<FormationEtat[]>`
    select ${tx.unsafe(COLONNES)}
    from public.formations f
    join public.agents a on a.id = f.agent_id
    join public.types_formation t on t.id = f.type_formation_id
    where f.agent_id = ${agentId} and f.type_formation_id = ${typeId} and f.archive_le is null
    order by f.date_formation desc, f.created_at desc`;
}

export type Agent = { id: string; nom: string; fonction: string | null; notes: string | null };
export type TypeFormation = { id: string; libelle: string; validite_mois: number | null; notes: string | null };

export async function referentielFormations(tx: Tx) {
  const [agents, types] = await Promise.all([
    tx<Agent[]>`select id, nom, fonction, notes from public.agents where archive_le is null order by lower(nom)`,
    tx<TypeFormation[]>`
      select id, libelle, validite_mois, notes from public.types_formation
      where archive_le is null order by lower(libelle)`,
  ]);
  return { agents, types };
}

/** Sessions prévues (date postérieure à aujourd'hui), les plus proches d'abord. */
export function formationsAVenir(tx: Tx, aujourdhui: string) {
  return tx<FormationEtat[]>`
    select ${tx.unsafe(COLONNES)}
    from public.formations f
    join public.agents a on a.id = f.agent_id and a.archive_le is null
    join public.types_formation t on t.id = f.type_formation_id and t.archive_le is null
    where f.archive_le is null and f.date_formation > ${aujourdhui}::date
    order by f.date_formation, lower(a.nom)`;
}
