import "server-only";
import type { Tx } from "@/lib/db";
import { normaliser } from "@/lib/metier/import";
import type { FicheRapport } from "@/lib/metier/rapport-pdf";

export type PlanChoix = { id: string; libelle: string };
export type Rapprochement = {
  /** Équipement reconnu par son n° de série (ou son code), s'il existe. */
  equipement: { code: string; libelle: string } | null;
  /** Plans actifs de cet équipement : le seul est présélectionné, plusieurs sont à départager. */
  plans: PlanChoix[];
};

/** Plans actifs pour le choix manuel, et rapprochement de chaque fiche du rapport avec le parc. */
export async function rapprocher(tx: Tx, fiches: FicheRapport[]) {
  const [plans, equipements] = await Promise.all([
    tx<(PlanChoix & { equipement_id: string | null })[]>`
      select v.plan_controle_id as id, v.equipement_id,
        v.type_libelle || ' — ' || coalesce(v.equipement_code || ' · ', '') || coalesce(v.perimetre, '') as libelle
      from public.v_plans_controle_echeance v
      order by v.type_libelle, v.equipement_code nulls first, v.perimetre`,
    tx<{ id: string; code: string; libelle: string; numero_serie: string | null }[]>`
      select id, code, libelle, numero_serie from public.equipements where archive_le is null`,
  ]);
  const rapprochements: Rapprochement[] = fiches.map((f) => {
    const serie = normaliser(f.numero_serie ?? "");
    const e = serie
      ? equipements.find((x) => normaliser(x.numero_serie ?? "") === serie || normaliser(x.code) === serie)
      : undefined;
    return {
      equipement: e ? { code: e.code, libelle: e.libelle } : null,
      plans: e ? plans.filter((p) => p.equipement_id === e.id).map(({ id, libelle }) => ({ id, libelle })) : [],
    };
  });
  return { plans: plans.map(({ id, libelle }) => ({ id, libelle })), rapprochements };
}
