// PGlite exposé en protocole Postgres pour tester les requêtes de l'application avec le vrai pilote (postgres.js),
// sous l'identité d'un utilisateur, exactement comme lib/db (rôle authenticated + claims : la RLS s'applique).

import type { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import type { Tx } from "@/lib/db";
import { creerBase, UTILISATEURS } from "./base";

export type Pilote = { db: PGlite; sql: postgres.Sql; fermer: () => Promise<void> };

export async function demarrerPilote(): Promise<Pilote> {
  const db = await creerBase();
  const port = 55000 + Math.floor(Math.random() * 5000);
  const serveur = new PGLiteSocketServer({ db, host: "127.0.0.1", port });
  await serveur.start();
  const sql = postgres(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`, {
    max: 1,
    prepare: false,
    onnotice: () => {},
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
  return {
    db,
    sql,
    fermer: async () => {
      await sql.end();
      await serveur.stop();
      await db.close();
    },
  };
}

class Annuler extends Error {}

/** Exécute fn sous l'identité donnée puis annule tout (chaque test part du seed). */
export async function enTantQueUtilisateur<T>(
  sql: postgres.Sql,
  role: keyof typeof UTILISATEURS,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  let resultat: T;
  await sql
    .begin(async (tx) => {
      const claims = JSON.stringify({ sub: UTILISATEURS[role], role: "authenticated", aal: "aal2" });
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;
      await tx`set local role authenticated`;
      resultat = await fn(tx);
      throw new Annuler();
    })
    .catch((e) => {
      if (!(e instanceof Annuler)) throw e;
    });
  return resultat!;
}
