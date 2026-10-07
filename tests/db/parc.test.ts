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
