import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schemaModificationGroupee } from "@/lib/metier/parc";
import { listerEquipements, PAR_PAGE } from "@/lib/requetes/parc";
import { demarrerPilote, enTantQueUtilisateur, type Pilote } from "./pilote";

let p: Pilote;

beforeAll(async () => {
  p = await demarrerPilote();
}, 60_000);

afterAll(async () => {
  await p?.fermer();
});

describe("parc (pilote postgres)", () => {
  it("modification groupée : univers posé, localisation retirée, archivés intouchés ; journal tracé", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const [u] = await tx<{ id: string }[]>`insert into public.univers (libelle) values ('Groupé') returning id`;
      const ids = (await tx<{ id: string }[]>`select id from public.equipements where archive_le is null limit 2`).map(
        (e) => e.id,
      );
      const { modifications } = schemaModificationGroupee.parse({ ids, univers_id: u.id, localisation_id: "aucun" });
      const lignes = await tx`
        update public.equipements set ${tx(modifications)} where id = any(${ids}::uuid[]) and archive_le is null
        returning id`;
      const apres = await tx<{ univers_id: string; localisation_id: string | null }[]>`
        select univers_id, localisation_id from public.equipements where id = any(${ids}::uuid[])`;
      return { n: lignes.length, apres, u: u.id };
    });
    expect(r.n).toBe(2);
    expect(r.apres).toEqual([
      { univers_id: r.u, localisation_id: null },
      { univers_id: r.u, localisation_id: null },
    ]);
  });

  it("lecture seule : la modification groupée ne touche rien (RLS)", async () => {
    const n = await enTantQueUtilisateur(p.sql, "lecture", async (tx) => {
      const lignes = await tx`update public.equipements set statut = 'reforme' returning id`;
      return lignes.length;
    });
    expect(n).toBe(0);
  });

  it("pagination : total exact, pages de PAR_PAGE, export sans limite", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      await tx`insert into public.equipements (code, libelle)
        select 'PAG-' || lpad(i::text, 4, '0'), 'Paginé' from generate_series(1, ${PAR_PAGE + 30}) i`;
      const p1 = await listerEquipements(tx, { q: "PAG-" }, 1);
      const p2 = await listerEquipements(tx, { q: "PAG-" }, 2);
      const tout = await listerEquipements(tx, { q: "PAG-" }, null);
      return { p1, p2, tout };
    });
    expect(r.p1.total).toBe(PAR_PAGE + 30);
    expect(r.p1.equipements).toHaveLength(PAR_PAGE);
    expect(r.p2.equipements).toHaveLength(30);
    expect(r.p2.equipements[0].code).toBe(`PAG-0${PAR_PAGE + 1}`);
    expect(r.tout.equipements).toHaveLength(PAR_PAGE + 30);
  });
});

describe("journal d'audit (pilote postgres)", () => {
  it("historique d'un plan : le plan, ses contrôles et ses réserves ; rien pour un technicien", async () => {
    const { historiqueFiche, lireJournal } = await import("@/lib/requetes/journal");
    const [plan] = await p.sql<{ id: string }[]>`
      select p.id from public.plans_controle p where exists (
        select 1 from public.controles c join public.reserves r on r.controle_id = c.id where c.plan_controle_id = p.id)
      limit 1`;
    const admin = await enTantQueUtilisateur(p.sql, "admin", async (tx) => {
      await tx`update public.plans_controle set periodicite_mois_surcharge = 7 where id = ${plan.id}`;
      return { fiche: await historiqueFiche(tx, "plans_controle", plan.id), page: await lireJournal(tx, { page: 1 }) };
    });
    const tables = new Set(admin.fiche.entrees.map((e) => e.table_cible));
    expect(tables).toEqual(new Set(["plans_controle", "controles", "reserves"]));
    expect(admin.fiche.entrees[0]).toMatchObject({
      table_cible: "plans_controle",
      action: "update",
      utilisateur_nom: expect.any(String),
    });
    expect(admin.page.total).toBeGreaterThan(0);
    const technicien = await enTantQueUtilisateur(p.sql, "technicien", (tx) =>
      historiqueFiche(tx, "plans_controle", plan.id),
    );
    expect(technicien.entrees).toEqual([]);
  });
});

describe("trous dans le suivi (pilote postgres)", () => {
  it("équipement en service sans plan signalé ; réserve « à détailler » signalée", async () => {
    const { verifications } = await import("@/lib/requetes/verifications");
    const categories = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      await tx`insert into public.equipements (code, libelle) values ('SANS-PLAN', 'Orphelin')`;
      return verifications(tx);
    });
    const parCle = Object.fromEntries(categories.map((c) => [c.cle, c.elements.map((e) => e.libelle)]));
    expect(parCle.equipements).toContain("SANS-PLAN — Orphelin");
    expect(parCle.equipements).not.toContain(expect.stringMatching(/^TGBT-A/));
    expect(parCle.reserves?.length).toBeGreaterThan(0);
  });
});
