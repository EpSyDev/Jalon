import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { creerBase, enTantQue } from "./base";

let db: PGlite;

beforeAll(async () => {
  db = await creerBase();
}, 60_000);

const CLE = "a".repeat(64);

async function enServiceRole<T>(fn: (q: PGlite["query"]) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return fn(tx.query.bind(tx) as PGlite["query"]);
  });
}

describe("limitation des tentatives de connexion", () => {
  it("la limite est atteinte au bout du nombre d'échecs, sur la fenêtre seulement", async () => {
    const atteinte = () =>
      enServiceRole(
        async (q) => (await q<{ a: boolean }>("select prive.limite_atteinte($1, 3, 15) as a", [CLE])).rows[0].a,
      );
    expect(await atteinte()).toBe(false);
    for (let i = 0; i < 3; i++) await enServiceRole((q) => q("select prive.noter_echec($1)", [CLE]));
    expect(await atteinte()).toBe(true);
    // Échecs anciens : hors fenêtre, puis purgés au-delà d'un jour.
    await db.query("update prive.tentatives_connexion set cree_le = now() - interval '2 days'");
    expect(await atteinte()).toBe(false);
    expect((await db.query<{ n: number }>("select count(*)::int as n from prive.tentatives_connexion")).rows[0].n).toBe(
      0,
    );
  });

  it("refuse une clé qui n'est pas une empreinte", async () => {
    await expect(enServiceRole((q) => q("select prive.noter_echec('jean@exemple.fr')"))).rejects.toThrow(/check/);
  });

  it("inaccessible aux rôles utilisateurs et anonyme", async () => {
    for (const role of ["anon", "admin", "technicien"] as const) {
      await expect(enTantQue(db, role, (tx) => tx.query("select prive.noter_echec($1)", [CLE]))).rejects.toThrow(
        /permission denied/,
      );
      await expect(enTantQue(db, role, (tx) => tx.query("select * from prive.tentatives_connexion"))).rejects.toThrow(
        /permission denied/,
      );
    }
  });
});
