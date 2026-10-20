import { describe, expect, it } from "vitest";
import {
  calculerEcheance,
  libelleValidite,
  schemaFormation,
  schemaTypeFormation,
  statutFormation,
} from "@/lib/metier/formations";

describe("calculerEcheance", () => {
  it("ajoute la validité du type à la date de formation", () => {
    expect(calculerEcheance("2026-03-15", 36)).toBe("2029-03-15");
    expect(calculerEcheance("2024-02-29", 12)).toBe("2025-02-28");
    expect(calculerEcheance("2026-03-15", null)).toBeNull();
  });
});

describe("statutFormation", () => {
  it.each([
    [null, "sans_echeance"],
    ["2026-10-19", "expiree"],
    ["2026-10-20", "bientot"],
    ["2026-12-19", "bientot"],
    ["2026-12-20", "valide"],
  ] as const)("échéance %s → %s (aujourd'hui 2026-10-20, seuil 60 jours)", (echeance, attendu) => {
    expect(statutFormation(echeance, "2026-10-20", 60)).toBe(attendu);
  });
});

describe("schemaFormation", () => {
  const base = { date_formation: "2026-05-04" };
  it("exige un agent et une formation, choisis ou saisis", () => {
    expect(schemaFormation.safeParse(base).success).toBe(false);
    expect(
      schemaFormation.safeParse({ ...base, agent_nouveau: "Paul Martin", type_nouveau: "Habilitation électrique" })
        .success,
    ).toBe(true);
  });
  it("durée et validité facultatives, échéance jamais avant la formation", () => {
    const ok = schemaFormation.parse({
      ...base,
      agent_nouveau: "Paul",
      type_nouveau: "SST",
      duree_heures: "14",
      validite_mois_nouveau: "24",
    });
    expect(ok).toMatchObject({ duree_heures: 14, validite_mois_nouveau: 24, echeance: null });
    expect(
      schemaFormation.safeParse({ ...base, agent_nouveau: "P", type_nouveau: "S", echeance: "2026-05-03" }).success,
    ).toBe(false);
    expect(
      schemaFormation.safeParse({ ...base, agent_nouveau: "P", type_nouveau: "S", duree_heures: "0" }).success,
    ).toBe(false);
  });
});

describe("schemaTypeFormation / libelleValidite", () => {
  it("validité entière en mois, vide = sans échéance", () => {
    expect(schemaTypeFormation.parse({ libelle: "SST", validite_mois: "" }).validite_mois).toBeNull();
    expect(schemaTypeFormation.safeParse({ libelle: "SST", validite_mois: "1.5" }).success).toBe(false);
    expect(libelleValidite(36)).toBe("3 ans");
    expect(libelleValidite(12)).toBe("1 an");
    expect(libelleValidite(18)).toBe("18 mois");
    expect(libelleValidite(null)).toBe("Sans échéance");
  });
});
