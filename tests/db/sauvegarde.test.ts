import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { exporterBase, restaurerBase, TABLES, type Executeur, type Sauvegarde } from "@/lib/sauvegarde";
import { OPTIONS_PGLITE, preparerBase } from "../../dev/base-locale.mts";
import { creerBase } from "./base";

const executeur = (db: Pick<PGlite, "query">): Executeur => ({
  requete: async (sql, params) => (await db.query(sql, params)).rows as never,
});

async function baseVierge() {
  const db = new PGlite(OPTIONS_PGLITE);
  await preparerBase(db, { seed: false });
  return db;
}

async function restaurer(db: PGlite, s: Sauvegarde) {
  return db.transaction((tx) => restaurerBase(executeur(tx), s));
}

describe("sauvegarde et restauration", () => {
  it("l'export couvre toutes les tables de la base", async () => {
    const db = await baseVierge();
    const { rows } = await db.query<{ t: string }>(
      "select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
    );
    expect(rows.map((r) => r.t).sort()).toEqual([...TABLES].sort());
  });

  it("restauration testée : base vierge → contenu identique, échéances comprises", async () => {
    const source = await creerBase();
    // Un peu d'activité pour avoir de l'audit et des identités à reprendre.
    await source.query("update public.equipements set notes = 'modifié' where code = 'TGBT-A'");
    const sauvegarde = JSON.parse(JSON.stringify(await exporterBase(executeur(source)))) as Sauvegarde;

    const cible = await baseVierge();
    const comptes = sauvegarde.tables.profils.map((p) => `('${p.id}', null)`).join(", ");
    await cible.exec(`insert into auth.users (id, email) values ${comptes}`);
    const bilan = await restaurer(cible, sauvegarde);
    expect(bilan.equipements).toBe(sauvegarde.tables.equipements.length);

    const reexport = await exporterBase(executeur(cible));
    for (const t of TABLES) expect(reexport.tables[t], t).toEqual(sauvegarde.tables[t]);

    const vue =
      "select plan_controle_id, statut_echeance, prochaine_echeance::text from public.v_plans_controle_echeance order by 1";
    expect((await cible.query(vue)).rows).toEqual((await source.query(vue)).rows);

    // Les triggers sont réactivés : une nouvelle écriture est bien journalisée.
    await cible.query("update public.equipements set notes = 'après' where code = 'TGBT-A'");
    const { rows } = await cible.query<{ n: number }>(
      "select count(*)::int as n from public.journal_audit where apres ->> 'notes' = 'après'",
    );
    expect(rows[0].n).toBe(1);
  }, 60_000);

  it("refuse une base cible non vide, des comptes manquants ou un fichier étranger", async () => {
    const source = await creerBase();
    const sauvegarde = JSON.parse(JSON.stringify(await exporterBase(executeur(source)))) as Sauvegarde;

    await expect(restaurer(source, sauvegarde)).rejects.toThrow(/n'est pas vide/);
    await expect(restaurer(await baseVierge(), sauvegarde)).rejects.toThrow(/compte\(s\) utilisateur absent/);
    await expect(restaurer(await baseVierge(), { ...sauvegarde, format: "autre" } as never)).rejects.toThrow(
      /non reconnu/,
    );
  }, 60_000);
});
