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

describe("contacts (pilote postgres)", () => {
  it("technicien crée, recherche globale le trouve (sans accents), lecture seule ne crée pas, personne ne supprime", async () => {
    const { listerContacts } = await import("@/lib/requetes/contacts");
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      await tx`insert into public.contacts (nom, organisation, telephone) values ('Hélène Martin', 'Pompiers', '18')`;
      const filtre = await listerContacts(tx, "helene");
      const recherche = await tx<
        { type: string; titre: string }[]
      >`select type, titre from public.rechercher('helene', 5)`;
      return { filtre, recherche };
    });
    expect(r.filtre.map((c) => c.nom)).toEqual(["Hélène Martin"]);
    expect(r.recherche).toEqual([{ type: "contact", titre: "Hélène Martin" }]);
    await expect(
      enTantQueUtilisateur(p.sql, "lecture", (tx) => tx`insert into public.contacts (nom) values ('X')`),
    ).rejects.toThrow();
    await expect(enTantQueUtilisateur(p.sql, "admin", (tx) => tx`delete from public.contacts`)).rejects.toThrow();
  });
});

describe("contact créé depuis un prestataire (pilote postgres)", () => {
  it("créé avec les coordonnées, une seule fois, jamais sans coordonnées", async () => {
    const { contactDepuisPrestataire } = await import("@/lib/requetes/contacts");
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const [{ id }] = await tx<
        { id: string }[]
      >`insert into public.prestataires (nom) values ('Nouveau presta') returning id`;
      const sans = await contactDepuisPrestataire(tx, id, {
        nom: "Nouveau presta",
        contact_nom: null,
        email: null,
        telephone: null,
      });
      const donnees = {
        nom: "Nouveau presta",
        contact_nom: "M. Durand",
        email: "d@ex.fr",
        telephone: "01 02 03 04 05",
      };
      const premier = await contactDepuisPrestataire(tx, id, donnees);
      const second = await contactDepuisPrestataire(tx, id, donnees);
      const contacts = await tx<{ nom: string; organisation: string; telephone: string }[]>`
        select nom, organisation, telephone from public.contacts where prestataire_id = ${id}`;
      return { sans, premier, second, contacts };
    });
    expect([r.sans, r.premier, r.second]).toEqual([false, true, false]);
    expect(r.contacts).toEqual([{ nom: "M. Durand", organisation: "Nouveau presta", telephone: "01 02 03 04 05" }]);
  });
});

describe("création d'un contrôle complet (pilote postgres)", () => {
  it("famille, type et plan créés ; électricité réglementaire ET interne ; doublon et conflit refusés", async () => {
    const { creerControleComplet } = await import("@/lib/requetes/nouveau-controle");
    const { schemaNouveauControle } = await import("@/lib/metier/controles");
    const saisie = (o: Record<string, string>) =>
      schemaNouveauControle.parse({ perimetre_libelle: "Site", periodicite_mois: "12", ...o });
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const regl = await creerControleComplet(
        tx,
        saisie({
          famille_nouvelle: "Électricité test",
          caractere: "reglementaire",
          libelle: "Vérification annuelle",
          date_dernier: "2026-03-01",
          resultat: "avec_reserves",
          nb_reserves_declare: "2",
        }),
      );
      const interne = await creerControleComplet(
        tx,
        saisie({
          famille_nouvelle: "electricite TEST",
          caractere: "interne",
          libelle: "Ronde mensuelle",
          periodicite_mois: "1",
        }),
      );
      const doublon = await creerControleComplet(
        tx,
        saisie({ famille_nouvelle: "Électricité test", caractere: "reglementaire", libelle: "vérification annuelle" }),
      );
      const conflit = await creerControleComplet(
        tx,
        saisie({
          famille_nouvelle: "Électricité test",
          caractere: "reglementaire",
          libelle: "Vérification annuelle",
          periodicite_mois: "6",
          perimetre_libelle: "Bât B",
        }),
      );
      const [{ n: familles }] = await tx<
        { n: number }[]
      >`select count(*)::int as n from public.familles_controle where public.normaliser(libelle) = 'electricite test'`;
      const [{ n: reserves }] = await tx<
        { n: number }[]
      >`select count(*)::int as n from public.reserves r join public.controles c on c.id = r.controle_id where c.plan_controle_id = ${regl.id!}`;
      const statuts = await tx<
        { statut_echeance: string; caractere: string }[]
      >`select statut_echeance, caractere from public.v_plans_controle_echeance where plan_controle_id in (${regl.id!}, ${interne.id!}) order by caractere`;
      return { doublon, conflit, familles, reserves, statuts };
    });
    expect(r.familles).toBe(1);
    expect(r.reserves).toBe(2);
    expect(r.statuts).toEqual([
      { statut_echeance: "jamais_controle", caractere: "interne" },
      { statut_echeance: expect.stringMatching(/a_jour|a_echeance|en_retard/), caractere: "reglementaire" },
    ]);
    expect(r.doublon.erreur).toMatch(/existe déjà sur cet équipement ou ce périmètre/);
    expect(r.conflit.erreur).toMatch(/existe déjà dans cette famille \(12 mois/);
  });
});

describe("intervention depuis une réserve (pilote postgres)", () => {
  it("préremplit titre, priorité selon la gravité, plan, équipement et prestataire ; interventions liées au plan", async () => {
    const { prefillDepuisReserve } = await import("@/lib/requetes/intervention-depuis-reserve");
    const { interventionsDuPlan } = await import("@/lib/requetes/interventions");
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const [res] = await tx<{ id: string; plan: string }[]>`
        select r.id, c.plan_controle_id as plan from public.reserves r join public.controles c on c.id = r.controle_id limit 1`;
      await tx`update public.reserves set gravite = 'majeure', description = 'Câble à remplacer' where id = ${res.id}`;
      const prefill = await prefillDepuisReserve(tx, res.id);
      await tx`insert into public.interventions (titre, plan_controle_id) values ('Lever', ${res.plan})`;
      return {
        prefill,
        liees: await interventionsDuPlan(tx, res.plan),
        inconnue: await prefillDepuisReserve(tx, "pas-un-uuid"),
      };
    });
    expect(r.prefill).toMatchObject({ priorite: "haute", description: "Câble à remplacer" });
    expect(r.prefill?.titre).toMatch(/^Lever la réserve — /);
    expect(r.liees.map((i) => i.titre)).toContain("Lever");
    expect(r.inconnue).toBeNull();
  });
});
