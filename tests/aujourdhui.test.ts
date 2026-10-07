import { describe, expect, it } from "vitest";
import { jalonDuJour, regroupements, type EntreeJalon, type PlanJour } from "@/lib/metier/aujourdhui";
import { trousDuSuivi } from "@/lib/metier/verifications";

const AUJ = "2026-10-07";

const plan = (id: string, surcharge: Partial<PlanJour> = {}): PlanJour => ({
  plan_controle_id: id,
  type_libelle: `Contrôle ${id}`,
  caractere: "reglementaire",
  statut_echeance: "a_jour",
  prochaine_echeance: "2027-06-01",
  equipement_code: null,
  perimetre: "Site",
  prestataire_id: null,
  prestataire_nom: null,
  ...surcharge,
});

const entree = (surcharge: Partial<EntreeJalon> = {}): EntreeJalon => ({
  aujourdhui: AUJ,
  plans: [],
  reserves: [],
  interventions: [],
  contrats: [],
  ...surcharge,
});

const contrat = (id: string, date_fin: string, preavis_jours: number) => ({
  contrat: { id, objet: `Contrat ${id}`, prestataire_nom: "P", date_fin, preavis_jours },
  alerte: "a_decider" as const,
});

describe("jalon du jour : ordre de priorité explicite", () => {
  it("rien à signaler → aucun jalon", () => {
    expect(jalonDuJour(entree({ plans: [plan("a")] }))).toBeNull();
  });

  it("préavis dans les 14 jours passe avant tout retard", () => {
    const j = jalonDuJour(
      entree({
        plans: [plan("r", { statut_echeance: "en_retard", prochaine_echeance: "2026-01-01" })],
        contrats: [contrat("k", "2026-11-17", 30)], // limite 18/10 : dans 11 jours
      }),
    );
    expect(j).toMatchObject({ lien: "/contrats/k" });
    expect(j?.pourquoi).toMatch(/Plus que 11 jours/);
  });

  it("retard réglementaire le plus ancien, avant un retard interne plus ancien", () => {
    const j = jalonDuJour(
      entree({
        plans: [
          plan("i", { caractere: "interne", statut_echeance: "en_retard", prochaine_echeance: "2025-01-01" }),
          plan("r1", { statut_echeance: "en_retard", prochaine_echeance: "2026-09-01" }),
          plan("r2", { statut_echeance: "en_retard", prochaine_echeance: "2026-08-01" }),
        ],
      }),
    );
    expect(j?.lien).toBe("/controles/plans/r2");
    expect(j?.pourquoi).toBe(
      "Contrôle réglementaire en retard depuis 67 jours (échéance du 01/08/2026) : le plus ancien des retards réglementaires, sur 3 retards.",
    );
  });

  it("puis réserve critique dépassée, puis intervention urgente, puis jamais contrôlé", () => {
    const reserve = {
      id: "x",
      gravite: "critique" as const,
      echeance_levee: "2026-10-01",
      plan_controle_id: "p",
      type_libelle: "SSI",
    };
    const urgente = { id: "u", titre: "Fuite", date_demande: "2026-10-05" };
    const jamais = plan("j", { statut_echeance: "jamais_controle", prochaine_echeance: null });
    expect(jalonDuJour(entree({ reserves: [reserve], interventions: [urgente], plans: [jamais] }))?.lien).toBe(
      "/controles/plans/p",
    );
    expect(jalonDuJour(entree({ interventions: [urgente], plans: [jamais] }))?.lien).toBe("/interventions/u");
    expect(jalonDuJour(entree({ plans: [jamais] }))?.lien).toBe("/controles/saisie?plan=j");
  });

  it("enfin préavis lointain, puis échéance la plus proche", () => {
    const proche = plan("e", { statut_echeance: "a_echeance", prochaine_echeance: "2026-10-20" });
    expect(jalonDuJour(entree({ plans: [proche], contrats: [contrat("k", "2027-01-30", 60)] }))?.lien).toBe(
      "/contrats/k",
    );
    expect(jalonDuJour(entree({ plans: [proche] }))?.pourquoi).toMatch(/dans 13 jours/);
  });
});

describe("regroupements par prestataire", () => {
  it("au moins deux contrôles du même prestataire dans la fenêtre (retards compris)", () => {
    const presta = { prestataire_id: "pr1", prestataire_nom: "Apave" };
    const g = regroupements(
      [
        plan("a", { ...presta, statut_echeance: "a_echeance", prochaine_echeance: "2026-11-20" }),
        plan("b", { ...presta, statut_echeance: "en_retard", prochaine_echeance: "2026-09-30" }),
        plan("c", { ...presta, statut_echeance: "a_jour", prochaine_echeance: "2027-05-01" }),
        plan("d", {
          prestataire_id: "pr2",
          prestataire_nom: "Seul",
          statut_echeance: "a_echeance",
          prochaine_echeance: "2026-11-01",
        }),
      ],
      AUJ,
      60,
    );
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ prestataire_nom: "Apave", du: "2026-09-30", au: "2026-11-20" });
    expect(g[0].plans.map((p) => p.plan_controle_id)).toEqual(["b", "a"]);
  });
});

describe("trous dans le suivi", () => {
  it("signale plus de deux périodes sans contrôle, plans sans prestataire, contrats sans fin", () => {
    const base = {
      type_libelle: "Contrôle",
      perimetre: "Site",
      equipement_code: null,
      periodicite_mois: 12,
    };
    const categories = trousDuSuivi({
      aujourdhui: AUJ,
      plans: [
        {
          ...base,
          plan_controle_id: "vieux",
          caractere: "interne",
          prestataire_id: "x",
          dernier_controle: "2024-10-06",
        },
        {
          ...base,
          plan_controle_id: "limite",
          caractere: "interne",
          prestataire_id: "x",
          dernier_controle: "2024-10-07",
        },
        {
          ...base,
          plan_controle_id: "sans",
          caractere: "reglementaire",
          prestataire_id: null,
          dernier_controle: "2026-01-01",
        },
        {
          ...base,
          plan_controle_id: "interne",
          caractere: "interne",
          prestataire_id: null,
          dernier_controle: "2026-01-01",
        },
      ],
      reservesADetailler: [],
      contratsSansFin: [{ id: "k", objet: "Ménage", prestataire_nom: "P" }],
      equipementsSansPlan: [],
    });
    expect(categories.map((c) => [c.cle, c.elements.map((e) => e.lien)])).toEqual([
      ["periodes", ["/controles/plans/vieux"]],
      ["prestataires", ["/controles/plans/sans"]],
      ["contrats", ["/contrats/k"]],
    ]);
  });
});

describe("tournée", () => {
  it("regroupe par local dans l'ordre reçu, sans local à la fin", async () => {
    const { grouperParLocal } = await import("@/lib/metier/tournee");
    const arrets = grouperParLocal([
      { id: 1, localisation_id: null, localisation: null },
      { id: 2, localisation_id: "a", localisation: "Bât A / RDC" },
      { id: 3, localisation_id: "b", localisation: "Bât B" },
      { id: 4, localisation_id: "a", localisation: "Bât A / RDC" },
    ]);
    expect(arrets.map((a) => [a.localisation, a.plans.map((p) => p.id)])).toEqual([
      ["Bât A / RDC", [2, 4]],
      ["Bât B", [3]],
      ["Sans local (installation ou périmètre)", [1]],
    ]);
  });
});
