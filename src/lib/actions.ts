import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requete } from "@/lib/auth";
import type { Tx } from "@/lib/db";
import { messageErreurBase } from "@/lib/erreurs";
import { premierMessage } from "@/lib/metier/controles";
import type { Role } from "@/lib/roles";

// Outils communs aux actions serveur : validation Zod, exécution sous l'identité de
// l'utilisateur (RLS), traduction des erreurs.

export type Resultat = { erreur: string } | { message: string } | undefined;

export const ECRITURE: Role[] = ["admin", "technicien"];
export const ADMIN: Role[] = ["admin"];

export const ID_INVALIDE = { erreur: "Identifiant invalide : rechargez la page." } as const;

/** Les identifiants liés (bind) transitent par le client : on les revalide. */
export function idsValides(...ids: string[]): boolean {
  return ids.every((id) => z.uuid().safeParse(id).success);
}

/** Refus métier dont le message est affiché tel quel. */
export class RefusMetier extends Error {}

type Saisie<S extends z.ZodType> =
  { ok: true; donnees: z.output<S>; erreur?: undefined } | { ok: false; donnees?: undefined; erreur: string };

export function valider<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  libelles: Record<string, string>,
): Saisie<S> {
  const saisie = schema.safeParse(Object.fromEntries(formData));
  return saisie.success
    ? { ok: true, donnees: saisie.data }
    : { ok: false, erreur: premierMessage(saisie.error, libelles) };
}

/** Exécute sous l'identité de l'utilisateur (RLS) et traduit les erreurs. Renvoie un message ou null. */
export async function executer(fn: (tx: Tx) => Promise<unknown>, roles: Role[] = ECRITURE): Promise<string | null> {
  try {
    await requete((tx) => fn(tx), roles);
    return null;
  } catch (e) {
    unstable_rethrow(e);
    return e instanceof RefusMetier ? e.message : messageErreurBase(e);
  }
}
