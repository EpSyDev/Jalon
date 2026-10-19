import { describe, expect, it } from "vitest";
import { retardTache, schemaTache } from "@/lib/metier/taches";

describe("schemaTache", () => {
  it("libellé obligatoire, échéance et précision facultatives", () => {
    expect(schemaTache.parse({ libelle: " Serrure chambre 12 " })).toEqual({
      libelle: "Serrure chambre 12",
      notes: null,
      echeance: null,
    });
    expect(schemaTache.parse({ libelle: "Agrafes", notes: "", echeance: "2026-11-02" }).echeance).toBe("2026-11-02");
    expect(schemaTache.safeParse({ libelle: "  " }).success).toBe(false);
    expect(schemaTache.safeParse({ libelle: "x", echeance: "demain" }).success).toBe(false);
  });
});

describe("retardTache", () => {
  it.each([
    [null, null],
    ["2026-10-19", null],
    ["2026-10-20", null],
    ["2026-10-18", 1],
    ["2026-10-09", 10],
  ] as const)("échéance %s → %s", (echeance, attendu) => {
    expect(retardTache(echeance, "2026-10-19")).toBe(attendu);
  });
});
