import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { prochaineEcheance, statutEcheance } from "@/lib/metier/echeance";
import { CAS_PROCHAINE_ECHEANCE, CAS_STATUT } from "../cas-echeance";
import { creerBase, enTantQue, UTILISATEURS } from "./base";

let db: PGlite;

beforeAll(async () => {
  db = await creerBase();
}, 60_000);

const NOUVEL_EQUIPEMENT =
  "insert into public.equipements (code, libelle) values ('TEST-1', 'Équipement de test') returning id";

describe("migrations et seed", () => {
  it("rejouent de zéro et créent les profils via trigger", async () => {
    const { rows } = await db.query<{ role: string }>("select role from public.profils order by role");
    expect(rows.map((r) => r.role)).toEqual(["admin", "lecture", "technicien"]);
  });

  it("génèrent un qr_token aléatoire distinct de l'id", async () => {
    const { rows } = await db.query<{ id: string; qr_token: string }>("select id, qr_token from public.equipements");
    for (const r of rows) {
      expect(r.qr_token).toMatch(/^[0-9a-f]{32}$/);
      expect(r.qr_token).not.toBe(r.id.replaceAll("-", ""));
    }
  });
});

describe("rôles et RLS", () => {
  it("anon ne lit rien, ni table ni vue", async () => {
    await expect(enTantQue(db, "anon", (tx) => tx.query("select * from public.equipements"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      enTantQue(db, "anon", (tx) => tx.query("select * from public.v_plans_controle_echeance")),
    ).rejects.toThrow(/permission denied/);
  });

  it("lecture lit mais n'écrit pas", async () => {
    const { rows } = await enTantQue(db, "lecture", (tx) => tx.query("select id from public.equipements"));
    expect(rows.length).toBeGreaterThan(0);
    await expect(enTantQue(db, "lecture", (tx) => tx.query(NOUVEL_EQUIPEMENT))).rejects.toThrow(/row-level security/);
  });

  it("technicien crée et modifie", async () => {
    const libelle = await enTantQue(db, "technicien", async (tx) => {
      const { rows } = await tx.query<{ id: string }>(NOUVEL_EQUIPEMENT);
      await tx.query("update public.equipements set libelle = 'Modifié' where id = $1", [rows[0].id]);
      return (await tx.query<{ libelle: string }>("select libelle from public.equipements where id = $1", [rows[0].id]))
        .rows[0].libelle;
    });
    expect(libelle).toBe("Modifié");
  });

  it("personne ne supprime, même un admin", async () => {
    for (const role of ["admin", "technicien"] as const) {
      await expect(enTantQue(db, role, (tx) => tx.query("delete from public.equipements"))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("le trigger bloque aussi la suppression hors application", async () => {
    await expect(db.query("delete from public.equipements where code = 'ANC-01'")).rejects.toThrow(
      /Suppression interdite/,
    );
  });

  it("seul l'admin archive", async () => {
    const sql = "update public.equipements set archive_le = now() where code = 'ANC-01'";
    await expect(enTantQue(db, "technicien", (tx) => tx.query(sql))).rejects.toThrow(/Seul un administrateur/);
    const n = await enTantQue(db, "admin", async (tx) => (await tx.query(sql)).affectedRows);
    expect(n).toBe(1);
  });

  it("paramètres modifiables par l'admin seulement", async () => {
    const sql = "update public.parametres set valeur = '30' where cle = 'seuil_a_echeance_jours'";
    expect(await enTantQue(db, "technicien", async (tx) => (await tx.query(sql)).affectedRows)).toBe(0);
    expect(await enTantQue(db, "admin", async (tx) => (await tx.query(sql)).affectedRows)).toBe(1);
  });

  it("un admin sans 2FA validée n'a que la lecture", async () => {
    const sql = "update public.parametres set valeur = '30' where cle = 'seuil_a_echeance_jours'";
    expect(await enTantQue(db, "admin_sans_2fa", async (tx) => (await tx.query(sql)).affectedRows)).toBe(0);
    await expect(enTantQue(db, "admin_sans_2fa", (tx) => tx.query(NOUVEL_EQUIPEMENT))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("un technicien ne peut pas s'auto-promouvoir", async () => {
    const sql = `update public.profils set role = 'admin' where id = '${UTILISATEURS.technicien}'`;
    expect(await enTantQue(db, "technicien", async (tx) => (await tx.query(sql)).affectedRows)).toBe(0);
  });

  it("un profil archivé perd tout accès", async () => {
    await db.query("update public.profils set archive_le = now() where id = $1", [UTILISATEURS.lecture]);
    const { rows } = await enTantQue(db, "lecture", (tx) => tx.query("select id from public.equipements"));
    expect(rows).toHaveLength(0);
    await db.query("update public.profils set archive_le = null where id = $1", [UTILISATEURS.lecture]);
  });
});

describe("journal d'audit", () => {
  it("trace création, modification et archivage avec l'auteur", async () => {
    const actions = await enTantQue(db, "admin", async (tx) => {
      const { rows } = await tx.query<{ id: string }>(NOUVEL_EQUIPEMENT);
      await tx.query("update public.equipements set libelle = 'X' where id = $1", [rows[0].id]);
      await tx.query("update public.equipements set archive_le = now() where id = $1", [rows[0].id]);
      return (
        await tx.query<{ action: string; utilisateur_id: string }>(
          "select action, utilisateur_id from public.journal_audit where enregistrement_id = $1 order by id",
          [rows[0].id],
        )
      ).rows;
    });
    expect(actions.map((a) => a.action)).toEqual(["insert", "update", "archive"]);
    expect(new Set(actions.map((a) => a.utilisateur_id))).toEqual(new Set([UTILISATEURS.admin]));
  });

  it("est illisible hors admin et non modifiable par quiconque", async () => {
    const { rows } = await enTantQue(db, "technicien", (tx) => tx.query("select * from public.journal_audit"));
    expect(rows).toHaveLength(0);
    for (const sql of [
      "insert into public.journal_audit (table_cible, enregistrement_id, action) values ('x', 'x', 'insert')",
      "update public.journal_audit set action = 'update'",
      "delete from public.journal_audit",
    ]) {
      await expect(enTantQue(db, "admin", (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("contraintes métier en base", () => {
  it("refuse un contrôle daté dans le futur", async () => {
    const sql = `insert into public.controles (plan_controle_id, date_realisation, resultat)
      select id, public.aujourdhui() + 1, 'conforme' from public.plans_controle limit 1`;
    await expect(enTantQue(db, "technicien", (tx) => tx.query(sql))).rejects.toThrow(/futur/);
  });

  it("refuse une réserve levée sans date de levée", async () => {
    const sql = `insert into public.reserves (controle_id, date_constat, statut)
      select id, date_realisation, 'levee' from public.controles limit 1`;
    await expect(enTantQue(db, "technicien", (tx) => tx.query(sql))).rejects.toThrow(/check constraint/);
  });

  it("refuse une périodicité nulle", async () => {
    const sql = "update public.types_controle set periodicite_mois = 0";
    await expect(enTantQue(db, "technicien", (tx) => tx.query(sql))).rejects.toThrow(/check constraint/);
  });

  it("refuse un rappel en double pour la même échéance", async () => {
    const sql =
      "insert into public.rappels_envoyes (cible_type, cible_id, seuil, echeance) values ('plan_controle', $1, 'J60', '2027-01-01')";
    const id = UTILISATEURS.admin;
    await db.query(sql, [id]);
    await expect(db.query(sql, [id])).rejects.toThrow(/duplicate key/);
    await db.query(
      "insert into public.rappels_envoyes (cible_type, cible_id, seuil, echeance) values ('plan_controle', $1, 'J60', '2028-01-01')",
      [id],
    );
  });
});

describe("échéances", () => {
  it("parité SQL / TypeScript sur prochaine_echeance", async () => {
    for (const c of CAS_PROCHAINE_ECHEANCE) {
      const { rows } = await db.query<{ r: string | null }>(
        "select public.prochaine_echeance($1::date, $2)::text as r",
        [c.dernier, c.mois],
      );
      expect(rows[0].r, c.nom).toBe(c.attendu);
      expect(prochaineEcheance(c.dernier, c.mois), c.nom).toBe(rows[0].r);
    }
  });

  it("parité SQL / TypeScript sur statut_echeance", async () => {
    for (const c of CAS_STATUT) {
      const { rows } = await db.query<{ r: string }>("select public.statut_echeance($1::date, $2::date, $3) as r", [
        c.echeance,
        c.aujourdhui,
        c.seuil,
      ]);
      expect(rows[0].r, c.nom).toBe(c.attendu);
      expect(statutEcheance(c.echeance, c.aujourdhui, c.seuil), c.nom).toBe(rows[0].r);
    }
  });

  it("la vue couvre tous les statuts du seed et exclut le matériel réformé", async () => {
    const { rows } = await enTantQue(db, "lecture", (tx) =>
      tx.query<{
        type_libelle: string;
        equipement_code: string | null;
        statut_echeance: string;
        nb_reserves_ouvertes: number;
        reserves_ouvertes: boolean;
      }>(
        "select type_libelle, equipement_code, statut_echeance, nb_reserves_ouvertes, reserves_ouvertes from public.v_plans_controle_echeance",
      ),
    );
    const par = Object.fromEntries(rows.map((r) => [r.type_libelle, r]));
    expect(par["Vérification installations électriques (exemple)"]).toMatchObject({
      statut_echeance: "en_retard",
      nb_reserves_ouvertes: 1,
    });
    expect(par["Thermographie TGBT (exemple)"].statut_echeance).toBe("a_echeance");
    expect(par["Visite ascenseur (exemple)"]).toMatchObject({ statut_echeance: "a_jour", reserves_ouvertes: true });
    expect(par["Contrôle éclairage de sécurité (exemple)"].statut_echeance).toBe("jamais_controle");
    expect(rows.some((r) => r.equipement_code === "ANC-01")).toBe(false);
  });

  it("la vue suit le seuil paramétré", async () => {
    const statut = await enTantQue(db, "admin", async (tx) => {
      await tx.query("update public.parametres set valeur = '10' where cle = 'seuil_a_echeance_jours'");
      const { rows } = await tx.query<{ statut_echeance: string }>(
        "select statut_echeance from public.v_plans_controle_echeance where type_libelle = 'Thermographie TGBT (exemple)'",
      );
      return rows[0].statut_echeance;
    });
    expect(statut).toBe("a_jour");
  });
});

describe("recherche globale", () => {
  const chercher = (role: "lecture" | "anon", q: string) =>
    enTantQue(db, role, (tx) =>
      tx.query<{ type: string; titre: string }>("select type, titre from public.rechercher($1, 10)", [q]),
    );

  it("ignore accents et casse", async () => {
    const { rows } = await chercher("lecture", "CHAUDIERE");
    expect(rows.some((r) => r.titre.includes("Chaudière gaz B"))).toBe(true);
  });

  it("tolère une faute de frappe", async () => {
    const { rows } = await chercher("lecture", "ascenceur");
    expect(rows.some((r) => r.titre.startsWith("Visite ascenseur"))).toBe(true);
  });

  it("exige tous les mots et trouve par code, prestataire ou localisation", async () => {
    expect((await chercher("lecture", "tgbt-a")).rows[0].titre).toMatch(/TGBT-A/);
    expect((await chercher("lecture", "biomaint")).rows.some((r) => r.type === "prestataire")).toBe(true);
    expect((await chercher("lecture", "chaufferie pompe")).rows).toHaveLength(0);
  });

  it("refuse l'accès anonyme", async () => {
    await expect(chercher("anon", "a")).rejects.toThrow(/permission denied/);
  });
});

describe("rappels (cron)", () => {
  it("service_role lit la vue et écrit dans rappels_envoyes ; un utilisateur ne peut pas y écrire", async () => {
    const n = await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      await tx.query(
        "insert into public.rappels_envoyes (cible_type, cible_id, seuil, echeance) values ('recap_hebdo', null, 'retard', '2026-10-05')",
      );
      return (await tx.query<{ n: number }>("select count(*)::int as n from public.v_plans_controle_echeance")).rows[0]
        .n;
    });
    expect(n).toBeGreaterThan(0);
    await expect(
      enTantQue(db, "admin", (tx) =>
        tx.query(
          "insert into public.rappels_envoyes (cible_type, seuil, echeance) values ('recap_hebdo', 'retard', '2026-10-12')",
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("accepte les seuils paramétrables et refuse les seuils fantaisistes", async () => {
    const sql =
      "insert into public.rappels_envoyes (cible_type, cible_id, seuil, echeance) values ('plan_controle', gen_random_uuid(), $1, '2027-01-01')";
    await db.query(sql, ["J45"]);
    await db.query(sql, ["J365"]);
    await expect(db.query(sql, ["J0"])).rejects.toThrow(/check constraint/);
    await expect(db.query(sql, ["J366"])).rejects.toThrow(/check constraint/);
  });
});

describe("statistiques (vues SQL)", () => {
  it("12 mois, dont le mois courant, et chiffres cohérents avec les tables", async () => {
    const r = await enTantQue(db, "lecture", async (tx) => ({
      mois: (await tx.query<{ n: number }>("select count(*)::int as n from public.v_stats_controles_mois")).rows[0].n,
      realises: (await tx.query<{ n: number }>("select sum(realises)::int as n from public.v_stats_controles_mois"))
        .rows[0].n,
      attendus: (
        await tx.query<{ n: number }>(
          "select count(*)::int as n from public.controles where archive_le is null and date_realisation >= date_trunc('month', public.aujourdhui()) - interval '11 months'",
        )
      ).rows[0].n,
      reserves: (await tx.query<{ ouvertes: number }>("select ouvertes from public.v_stats_reserves")).rows[0].ouvertes,
      contrats: (await tx.query<{ actifs: number }>("select actifs from public.v_stats_contrats")).rows[0].actifs,
    }));
    expect(r.mois).toBe(12);
    expect(r.realises).toBe(r.attendus);
    expect(r.reserves).toBeGreaterThan(0);
    expect(r.contrats).toBe(3);
  });

  it("refuse l'accès anonyme", async () => {
    await expect(enTantQue(db, "anon", (tx) => tx.query("select * from public.v_stats_reserves"))).rejects.toThrow(
      /permission denied/,
    );
  });
});
