// Base Postgres embarquée (PGlite) en mémoire : migrations rejouées de zéro + seed fictif.

import { PGlite, type Transaction } from "@electric-sql/pglite";
import { preparerBase } from "../../dev/base-locale.mts";

export const UTILISATEURS = {
  admin: "00000000-0000-4000-a000-000000000001",
  technicien: "00000000-0000-4000-a000-000000000002",
  lecture: "00000000-0000-4000-a000-000000000003",
} as const;

export type Role = keyof typeof UTILISATEURS | "anon" | "admin_sans_2fa";

export async function creerBase(): Promise<PGlite> {
  const db = new PGlite();
  await preparerBase(db);
  return db;
}

/** Exécute fn sous l'identité donnée, comme l'application. Transaction annulée à la fin. */
export async function enTantQue<T>(db: PGlite, role: Role, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let resultat: T;
  await db
    .transaction(async (tx) => {
      if (role === "anon") {
        await tx.exec("set local role anon");
      } else {
        const claims =
          role === "admin_sans_2fa"
            ? { sub: UTILISATEURS.admin, aal: "aal1" }
            : { sub: UTILISATEURS[role], aal: role === "admin" ? "aal2" : "aal1" };
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        await tx.exec("set local role authenticated");
      }
      resultat = await fn(tx);
      throw new AnnulerTransaction();
    })
    .catch((e) => {
      if (!(e instanceof AnnulerTransaction)) throw e;
    });
  return resultat!;
}

class AnnulerTransaction extends Error {}
