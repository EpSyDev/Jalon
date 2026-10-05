// Base Postgres embarquée (PGlite) : migrations rejouées de zéro + seed fictif.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const RACINE = join(__dirname, "..", "..");

export const UTILISATEURS = {
  admin: "00000000-0000-4000-a000-000000000001",
  technicien: "00000000-0000-4000-a000-000000000002",
  lecture: "00000000-0000-4000-a000-000000000003",
} as const;

export type Role = keyof typeof UTILISATEURS | "anon" | "admin_sans_2fa";

function lire(...chemin: string[]): string {
  return readFileSync(join(RACINE, ...chemin), "utf8");
}

export async function creerBase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(lire("tests", "db", "supabase-stub.sql"));

  const migrations = readdirSync(join(RACINE, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const fichier of migrations) {
    try {
      await db.exec(lire("supabase", "migrations", fichier));
    } catch (e) {
      throw new Error(`Migration ${fichier} : ${(e as Error).message}`);
    }
  }

  // Équivalent PGlite de seed/01_utilisateurs.sql (auth.users simplifiée).
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${UTILISATEURS.admin}', 'admin@jalon.local', '{"nom":"Alice Admin"}'),
      ('${UTILISATEURS.technicien}', 'technicien@jalon.local', '{"nom":"Thomas Technicien"}'),
      ('${UTILISATEURS.lecture}', 'lecture@jalon.local', '{"nom":"Léa Lecture"}');
    update public.profils set role = 'admin' where id = '${UTILISATEURS.admin}';
    update public.profils set role = 'technicien' where id = '${UTILISATEURS.technicien}';
  `);
  await db.exec(lire("supabase", "seed", "02_donnees.sql"));
  return db;
}

/** Exécute fn sous l'identité donnée, comme une requête PostgREST. Transaction annulée à la fin. */
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
