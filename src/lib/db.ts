import "server-only";
import postgres from "postgres";
import { lireEnv } from "@/lib/env";

export type Tx = postgres.TransactionSql;

export type Identite = { id: string; aal: "aal1" | "aal2" };

const globale = globalThis as unknown as { __jalonSql?: postgres.Sql };

/**
 * Connexion brute (propriétaire des tables, RLS contournée).
 * Usage réservé : avecUtilisateur() et l'écran de connexion locale.
 */
export function sqlBrut(): postgres.Sql {
  // prepare: false requis par le pooler Supabase en mode transaction.
  globale.__jalonSql ??= postgres(lireEnv().DATABASE_URL, {
    max: 5,
    prepare: false,
    onnotice: () => {},
    // Les dates métier restent des chaînes AAAA-MM-JJ : aucune conversion de fuseau possible.
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
  return globale.__jalonSql;
}

/**
 * Exécute fn dans une transaction sous l'identité de l'utilisateur :
 * rôle « authenticated » + claims JWT, exactement comme PostgREST. La RLS s'applique.
 */
export async function avecUtilisateur<T>(identite: Identite, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const resultat = await sqlBrut().begin(async (tx) => {
    const claims = JSON.stringify({ sub: identite.id, role: "authenticated", aal: identite.aal });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  });
  return resultat as T;
}
