import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { categorieParNom, equipementsAEtiqueter, listerEquipements, syntheseParUnivers } from "@/lib/requetes/parc";
import { demarrerPilote, enTantQueUtilisateur, type Pilote } from "./pilote";

let p: Pilote;

beforeAll(async () => {
  p = await demarrerPilote();
}, 60_000);

afterAll(async () => {
  await p?.fermer();
});

const idUnivers = (tx: Parameters<Parameters<typeof enTantQueUtilisateur>[2]>[0], libelle: string) =>
  tx<{ id: string }[]>`select id from public.univers where libelle = ${libelle}`.then((r) => r[0].id);

describe("catégories de matériel (pilote postgres)", () => {
  it("la liste d'un univers ne propose que ses catégories, avec leurs nombres", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const bio = await idUnivers(tx, "Biomédical");
      return listerEquipements(tx, { univers: bio }, 1);
    });
    const libelles = r.equipements.map((e) => e.categorie);
    expect(new Set(libelles)).toEqual(new Set(["Oxymètres", "Lits médicalisés"]));
    expect(Object.values(r.facettes.categories)).toEqual([1, 1]);
    // Aucune catégorie de la technique bâtiment (tableaux électriques…) dans le biomédical.
    expect(r.equipements.map((e) => e.code).sort()).toEqual(["LIT-101", "OXY-01"]);
  });

  it("recherche par catégorie et n° de série ; retirés masqués par défaut mais comptés", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      await tx`update public.equipements set numero_serie = 'SN-77Z' where code = 'OXY-01'`;
      return {
        serie: await listerEquipements(tx, { q: "sn-77z" }, 1),
        categorie: await listerEquipements(tx, { q: "oxymetre" }, 1),
        chaufferie: await listerEquipements(tx, { q: "chaufferie" }, 1),
      };
    });
    expect(r.serie.equipements.map((e) => e.code)).toEqual(["OXY-01"]);
    expect(r.categorie.equipements.map((e) => e.code)).toEqual(["OXY-01"]);
    // ANC-01 (réformé) est dans la chaufferie : masqué, mais compté dans la facette des statuts.
    expect(r.chaufferie.equipements.map((e) => e.code)).toEqual(["CHAUD-B"]);
    expect(r.chaufferie.facettes.statuts.reforme).toBe(1);
  });

  it("refuse une catégorie d'un autre univers ; une transversale va partout", async () => {
    await expect(
      enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
        const [lit] = await tx<
          { id: string }[]
        >`select id from public.categories_equipement where libelle = 'Lits médicalisés'`;
        await tx`update public.equipements set categorie_id = ${lit.id} where code = 'TGBT-A'`;
      }),
    ).rejects.toThrow(/appartient à un autre univers/);
    const ok = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const id = await categorieParNom(tx, "Divers", null);
      await tx`update public.equipements set categorie_id = ${id} where code in ('TGBT-A', 'OXY-01')`;
      return tx<{ n: number }[]>`select count(*)::int as n from public.equipements where categorie_id = ${id}`;
    });
    expect(ok[0].n).toBe(2);
  });

  it("ranger une catégorie transversale dans un univers y range ses équipements (journal tracé)", async () => {
    const r = await enTantQueUtilisateur(p.sql, "admin", async (tx) => {
      const bio = await idUnivers(tx, "Biomédical");
      const id = await categorieParNom(tx, "Thermomètres", null);
      await tx`insert into public.equipements (code, libelle, categorie_id) values ('TH-1', 'Thermomètre', ${id})`;
      await tx`update public.categories_equipement set univers_id = ${bio} where id = ${id}`;
      const [e] = await tx<{ univers_id: string; id: string }[]>`
        select id, univers_id from public.equipements where code = 'TH-1'`;
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.journal_audit
        where table_cible = 'equipements' and enregistrement_id = ${e.id} and action = 'update'`;
      return { bio, e, n };
    });
    expect(r.e.univers_id).toBe(r.bio);
    expect(r.n).toBe(1);
  });

  it("même nom dans un même univers refusé (accents et casse ignorés) ; dans un autre univers accepté", async () => {
    await expect(
      enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
        const bio = await idUnivers(tx, "Biomédical");
        await tx`insert into public.categories_equipement (libelle, univers_id) values ('OXYMETRES', ${bio})`;
      }),
    ).rejects.toThrow(/duplicate key/);
    const autre = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const tech = await idUnivers(tx, "Technique bâtiment");
      return tx`insert into public.categories_equipement (libelle, univers_id) values ('Oxymètres', ${tech}) returning id`;
    });
    expect(autre).toHaveLength(1);
  });

  it("lecture seule : ne crée pas de catégorie", async () => {
    await expect(
      enTantQueUtilisateur(
        p.sql,
        "lecture",
        (tx) => tx`insert into public.categories_equipement (libelle) values ('X')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("étiquettes QR (pilote postgres)", () => {
  it("périmètre par univers ou catégorie, matériel retiré exclu, rangé par catégorie puis code", async () => {
    const r = await enTantQueUtilisateur(p.sql, "lecture", async (tx) => {
      const tech = await idUnivers(tx, "Technique bâtiment");
      const [chaufferie] = await tx<{ id: string }[]>`
        select id from public.categories_equipement where libelle = 'Chaufferie'`;
      return {
        univers: await equipementsAEtiqueter(tx, { univers: tech }),
        categorie: await equipementsAEtiqueter(tx, { univers: tech, categorie: chaufferie.id }),
        tout: await equipementsAEtiqueter(tx),
      };
    });
    // ANC-01 (réformé) n'est jamais étiqueté.
    expect(r.univers.map((e) => e.code)).toEqual(["ASC-B1", "CHAUD-B", "ECL-SEC-A1", "TGBT-A"]);
    expect(r.categorie.map((e) => e.code)).toEqual(["CHAUD-B"]);
    expect(r.tout.map((e) => e.code)).not.toContain("ANC-01");
    expect(r.tout[0]).toMatchObject({ univers: "Biomédical", qr_token: expect.stringMatching(/^[0-9a-f]{32}$/) });
  });
});

describe("statuts détaillés (pilote postgres)", () => {
  it("un changement de statut est daté du jour ; le seed garde sa réparation externe", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      await tx`update public.equipements set statut = 'indisponible' where code = 'OXY-01'`;
      return tx<
        { code: string; statut_depuis: string; statut_retour_prevu: string | null; prestataire: string | null }[]
      >`
        select e.code, e.statut_depuis, e.statut_retour_prevu, p.nom as prestataire
        from public.equipements e left join public.prestataires p on p.id = e.statut_prestataire_id
        where e.code in ('OXY-01', 'LIT-101') order by e.code`;
    });
    expect(r[1]).toMatchObject({ code: "OXY-01", statut_depuis: aujourdhuiParis(), statut_retour_prevu: null });
    expect(r[0]).toMatchObject({ code: "LIT-101", prestataire: "BioMaint Fictif" });
  });

  it("garde-fous : prestataire hors réparation externe, retour avant le début, début dans le futur", async () => {
    const essai = (sql: string) => enTantQueUtilisateur(p.sql, "technicien", (tx) => tx.unsafe(sql));
    await expect(essai("update public.equipements set statut = 'en_service' where code = 'LIT-101'")).rejects.toThrow(
      /equipements_statut_prestataire|equipements_statut_retour/,
    );
    await expect(
      essai("update public.equipements set statut_retour_prevu = statut_depuis - 1 where code = 'LIT-101'"),
    ).rejects.toThrow(/equipements_statut_retour_apres/);
    await expect(
      essai("update public.equipements set statut_depuis = public.aujourdhui() + 1 where code = 'OXY-01'"),
    ).rejects.toThrow(/début du statut/);
  });

  it("déclassé : plus d'alerte de contrôle (comme réformé), sorti des comptes « en parc »", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const avant = await tx`select 1 from public.v_plans_controle_echeance where equipement_code = 'ASC-B1'`;
      await tx`update public.equipements set statut = 'declasse' where code = 'ASC-B1'`;
      const apres = await tx`select 1 from public.v_plans_controle_echeance where equipement_code = 'ASC-B1'`;
      const synthese = await syntheseParUnivers(tx);
      const tech = await idUnivers(tx, "Technique bâtiment");
      return { avant: avant.length, apres: apres.length, tech: synthese.find((s) => s.univers_id === tech) };
    });
    expect(r.avant).toBeGreaterThan(0);
    expect(r.apres).toBe(0);
    // TGBT-A, CHAUD-B, ECL-SEC-A1 en parc ; ASC-B1 (déclassé) et ANC-01 (réformé) retirés ; ECL hors service.
    expect(r.tech).toMatchObject({ en_parc: 3, retires: 2, indisponibles: 1 });
  });
});

describe("reprise des familles d'équipement en catégories (migration 20261012000100)", () => {
  it("une catégorie par univers et par famille ; familles sans type archivées ; familles de contrôle gardées", async () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20261012000100_parc_categories_statuts.sql"),
      "utf8",
    );
    const reprise = migration.slice(migration.indexOf("-- Reprise des données"));
    class Annuler extends Error {}
    let r:
      { categories: readonly unknown[]; equipements: readonly unknown[]; familles: readonly unknown[] } | undefined;
    await p.sql
      .begin(async (tx) => {
        // État d'avant la migration : des familles posées sur des équipements, avec ou sans univers.
        await tx`insert into public.familles_controle (libelle) values ('OXYMETRE'), ('Oxymètre')`;
        await tx`update public.equipements set categorie_id = null, famille_id = (
          select id from public.familles_controle where libelle = 'OXYMETRE') where code in ('OXY-01', 'LIT-101')`;
        await tx`update public.equipements set univers_id = null, categorie_id = null, famille_id = (
          select id from public.familles_controle where libelle = 'Oxymètre') where code = 'TGBT-A'`;
        await tx`update public.equipements set categorie_id = null, famille_id = (
          select id from public.familles_controle where libelle = 'Électricité') where code = 'ECL-SEC-A1'`;
        await tx.unsafe(reprise);
        r = {
          categories: await tx`
            select c.libelle, u.libelle as univers from public.categories_equipement c
            left join public.univers u on u.id = c.univers_id
            where c.created_at = now() order by c.libelle, u.libelle`,
          equipements: await tx`
            select e.code, e.famille_id, c.libelle as categorie from public.equipements e
            left join public.categories_equipement c on c.id = e.categorie_id
            where e.code in ('OXY-01', 'LIT-101', 'TGBT-A', 'ECL-SEC-A1') order by e.code`,
          familles: await tx`
            select libelle, archive_le is not null as archivee from public.familles_controle
            where libelle in ('OXYMETRE', 'Oxymètre', 'Électricité') order by libelle`,
        };
        throw new Annuler();
      })
      .catch((e) => {
        if (!(e instanceof Annuler)) throw e;
      });
    const trier = (l: readonly unknown[]) => [...l].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(trier(r!.categories)).toEqual(
      trier([
        { libelle: "Électricité", univers: "Technique bâtiment" },
        { libelle: "OXYMETRE", univers: "Biomédical" },
        { libelle: "Oxymètre", univers: null },
      ]),
    );
    expect(r!.equipements).toEqual([
      { code: "ECL-SEC-A1", famille_id: null, categorie: "Électricité" },
      { code: "LIT-101", famille_id: null, categorie: "OXYMETRE" },
      { code: "OXY-01", famille_id: null, categorie: "OXYMETRE" },
      { code: "TGBT-A", famille_id: null, categorie: "Oxymètre" },
    ]);
    expect(trier(r!.familles)).toEqual(
      trier([
        { libelle: "Électricité", archivee: false },
        { libelle: "Oxymètre", archivee: true },
        { libelle: "OXYMETRE", archivee: true },
      ]),
    );
  });
});

describe("suppression définitive et EPI (pilote postgres)", () => {
  it("admin supprime un EPI : tracé au journal avec son contenu ; technicien et lecture ne le peuvent pas", async () => {
    const r = await enTantQueUtilisateur(p.sql, "admin", async (tx) => {
      const [{ id }] = await tx<{ id: string }[]>`
        insert into public.epi (libelle, quantite, date_peremption) values ('Gants isolants', 4, '2027-03-01') returning id`;
      const supprimes = await tx`delete from public.epi where id = ${id} returning id`;
      const [j] = await tx<{ action: string; avant: { libelle: string } | null; apres: unknown }[]>`
        select action, avant, apres from public.journal_audit
        where table_cible = 'epi' and enregistrement_id = ${id} and action = 'delete'`;
      return { supprimes: supprimes.length, j };
    });
    expect(r.supprimes).toBe(1);
    expect(r.j).toMatchObject({ action: "delete", avant: { libelle: "Gants isolants" }, apres: null });

    for (const role of ["technicien", "lecture"] as const) {
      const n = await enTantQueUtilisateur(p.sql, role, async (tx) => {
        const [{ id }] = await tx<{ id: string }[]>`
          insert into public.epi (libelle) values ('X') returning id`.catch(() => [{ id: "" }]);
        return id ? (await tx`delete from public.epi where id = ${id} returning id`).length : 0;
      });
      expect(n).toBe(0);
    }
  });

  it("un équipement avec historique ne se supprime pas (clés étrangères) ; sans historique, oui", async () => {
    const { supprimerFiche } = await import("@/lib/actions");
    const r = await enTantQueUtilisateur(p.sql, "admin", async (tx) => {
      const [libre] = await tx<{ id: string }[]>`
        insert into public.equipements (code, libelle) values ('LIBRE-1', 'Sans historique') returning id`;
      await supprimerFiche(tx, "equipements", libre.id);
      const restant = await tx`select 1 from public.equipements where id = ${libre.id}`;
      let refus = "";
      await tx`savepoint s`;
      try {
        const [{ id }] = await tx<{ id: string }[]>`select id from public.equipements where code = 'TGBT-A'`;
        await supprimerFiche(tx, "equipements", id);
      } catch (e) {
        refus = (e as Error).message;
        await tx`rollback to savepoint s`;
      }
      return { restant: restant.length, refus };
    });
    expect(r.restant).toBe(0);
    expect(r.refus).toMatch(/encore utilisé ailleurs/);
  });
});
