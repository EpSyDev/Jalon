import { describe, expect, it } from "vitest";
import {
  appliquerTransition,
  comparerInterventions,
  schemaChantier,
  schemaIntervention,
  transitionsPossibles,
} from "@/lib/metier/interventions";

const AUJ = "2026-10-06";
const ouverte = { statut: "en_cours" as const, date_demande: "2026-10-01" };

describe("cycle de vie d'une intervention", () => {
  it("création → démarrage → attente → reprise → clôture", () => {
    let etat = { statut: "a_faire" as const, date_demande: "2026-10-01" } as Parameters<typeof appliquerTransition>[0];
    for (const cible of ["en_cours", "en_attente", "en_cours"] as const) {
      const r = appliquerTransition(etat, cible, null, AUJ);
      expect(r).toEqual({ statut: cible, date_cloture: null });
      etat = { ...etat, statut: cible };
    }
    expect(appliquerTransition(etat, "terminee", null, AUJ)).toEqual({ statut: "terminee", date_cloture: AUJ });
  });

  it("clôture à une date passée choisie", () => {
    expect(appliquerTransition(ouverte, "terminee", "2026-10-03", AUJ)).toEqual({
      statut: "terminee",
      date_cloture: "2026-10-03",
    });
  });

  it("refuse une clôture future ou antérieure à la demande", () => {
    expect(appliquerTransition(ouverte, "terminee", "2026-10-07", AUJ)).toEqual({
      erreur: "La date de clôture ne peut pas être dans le futur.",
    });
    expect(appliquerTransition(ouverte, "annulee", "2026-09-30", AUJ)).toMatchObject({ erreur: /précède/ });
  });

  it("réouverture d'une intervention terminée : la date de clôture est effacée", () => {
    expect(appliquerTransition({ statut: "terminee", date_demande: "2026-10-01" }, "en_cours", null, AUJ)).toEqual({
      statut: "en_cours",
      date_cloture: null,
    });
  });

  it("refuse les transitions incohérentes", () => {
    expect(transitionsPossibles("terminee")).toEqual(["en_cours"]);
    expect(appliquerTransition({ statut: "terminee", date_demande: "2026-10-01" }, "annulee", null, AUJ)).toMatchObject(
      {
        erreur: /impossible/,
      },
    );
    expect(appliquerTransition(ouverte, "en_cours", null, AUJ)).toMatchObject({ erreur: /impossible/ });
  });
});

it("tri : priorité puis date prévue", () => {
  const liste = [
    { id: 1, priorite: "normale" as const, date_prevue: "2026-10-02" },
    { id: 2, priorite: "urgente" as const, date_prevue: null },
    { id: 3, priorite: "normale" as const, date_prevue: "2026-10-01" },
    { id: 4, priorite: "haute" as const, date_prevue: "2026-12-01" },
  ];
  expect([...liste].sort(comparerInterventions).map((x) => x.id)).toEqual([2, 4, 3, 1]);
});

describe("schémas", () => {
  it("intervention minimale", () => {
    expect(
      schemaIntervention.parse({ type: "corrective", titre: "Fuite", priorite: "haute", equipement_id: "" }),
    ).toMatchObject({
      equipement_id: null,
      date_prevue: null,
    });
    expect(schemaIntervention.safeParse({ type: "corrective", titre: " ", priorite: "haute" }).success).toBe(false);
  });

  it("chantier : dates cohérentes et date de fin réelle pour un chantier terminé", () => {
    const base = { titre: "Réfection", statut: "en_cours", date_debut: "2026-09-01" };
    expect(schemaChantier.safeParse(base).success).toBe(true);
    expect(schemaChantier.safeParse({ ...base, date_fin_prevue: "2026-08-01" }).success).toBe(false);
    expect(schemaChantier.safeParse({ ...base, statut: "termine" }).success).toBe(false);
    expect(schemaChantier.safeParse({ ...base, statut: "termine", date_fin_reelle: "2026-10-01" }).success).toBe(true);
  });
});
