import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { messageErreurBase } from "@/lib/erreurs";
import { creerBase, enTantQue } from "./base";

let db: PGlite;

beforeAll(async () => {
  db = await creerBase();
}, 60_000);

describe("garde-fous de dates en base", () => {
  it.each([
    ["equipements", "insert into public.equipements (code, libelle, date_mise_en_service) values ('F-1', 'X', $1)"],
    ["chantiers", "insert into public.chantiers (titre, date_fin_reelle) values ('X', $1)"],
    [
      "interventions",
      "insert into public.interventions (titre, statut, date_demande, date_cloture) values ('X', 'terminee', public.aujourdhui(), $1)",
    ],
  ])("%s : une date future est refusée, avec un message lisible", async (_, sql) => {
    const demain = (await db.query<{ d: string }>("select (public.aujourdhui() + 1)::text as d")).rows[0].d;
    const erreur = await enTantQue(db, "technicien", (tx) => tx.query(sql, [demain])).catch((e) => e);
    expect(erreur).toBeInstanceOf(Error);
    expect(messageErreurBase(erreur)).toMatch(/^La date \(.+\) ne peut pas être dans le futur\.$/);
  });

  it("levée de réserve : aujourd'hui accepté, demain refusé", async () => {
    const lever = (decalage: number) =>
      enTantQue(db, "technicien", (tx) =>
        tx.query(
          `update public.reserves set statut = 'levee', date_levee = public.aujourdhui() + $1::int
           where id = (select id from public.reserves where statut = 'ouverte' order by id limit 1)`,
          [decalage],
        ),
      );
    await expect(lever(0)).resolves.toBeDefined();
    await expect(lever(1)).rejects.toThrow(/futur/);
  });
});
