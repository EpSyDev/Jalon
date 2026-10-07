import "server-only";
import { z } from "zod";
import type { Tx } from "@/lib/db";
import { lireReserve } from "@/lib/requetes/controles";

export type PrefillIntervention = {
  titre: string;
  description: string | undefined;
  priorite: string;
  plan_controle_id: string;
  equipement_id: string | undefined;
  prestataire_id: string | undefined;
};

/** Priorité proposée (modifiable) d'après la gravité saisie sur la réserve. */
const PRIORITE = { critique: "urgente", majeure: "haute", mineure: "normale" } as const;

/** Pré-remplissage d'une intervention depuis une réserve : plan, équipement et prestataire du contrôle concerné. */
export async function prefillDepuisReserve(tx: Tx, reserveId: string): Promise<PrefillIntervention | null> {
  if (!z.uuid().safeParse(reserveId).success) return null;
  const reserve = await lireReserve(tx, reserveId);
  if (!reserve) return null;
  const [plan] = await tx<{ equipement_id: string | null; prestataire_id: string | null }[]>`
    select equipement_id, prestataire_id from public.plans_controle where id = ${reserve.plan_controle_id}`;
  return {
    titre: `Lever la réserve — ${reserve.type_libelle}`.slice(0, 200),
    description: reserve.description === "À détailler" ? undefined : reserve.description,
    priorite: (reserve.gravite && PRIORITE[reserve.gravite]) || "normale",
    plan_controle_id: reserve.plan_controle_id,
    equipement_id: plan?.equipement_id ?? undefined,
    prestataire_id: plan?.prestataire_id ?? undefined,
  };
}
