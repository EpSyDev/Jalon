import "server-only";
import type { Tx } from "@/lib/db";

export type Tache = {
  id: string;
  libelle: string;
  notes: string | null;
  echeance: string | null;
  created_at: string;
  resolue_le: string | null;
  resolue_par_nom: string | null;
};

const COLONNES = `t.id, t.libelle, t.notes, t.echeance::text as echeance,
  (t.created_at at time zone 'Europe/Paris')::date::text as created_at,
  (t.resolue_le at time zone 'Europe/Paris')::date::text as resolue_le, p.nom as resolue_par_nom`;

/** Tâches ouvertes : échéances les plus proches d'abord, puis les plus anciennes. */
export function tachesOuvertes(tx: Tx) {
  return tx<Tache[]>`
    select ${tx.unsafe(COLONNES)} from public.taches t left join public.profils p on p.id = t.resolue_par
    where t.resolue_le is null
    order by t.echeance nulls last, t.created_at`;
}

/** Dernières tâches résolues (30 par défaut). */
export function tachesResolues(tx: Tx, limite = 30) {
  return tx<Tache[]>`
    select ${tx.unsafe(COLONNES)} from public.taches t left join public.profils p on p.id = t.resolue_par
    where t.resolue_le is not null
    order by t.resolue_le desc
    limit ${limite}`;
}
