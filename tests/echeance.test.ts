import { describe, expect, it } from "vitest";
import { aujourdhuiParis, prochaineEcheance, statutEcheance } from "@/lib/metier/echeance";
import { CAS_PROCHAINE_ECHEANCE, CAS_STATUT } from "./cas-echeance";

describe("prochaineEcheance", () => {
  it.each(CAS_PROCHAINE_ECHEANCE)("$nom", ({ dernier, mois, attendu }) => {
    expect(prochaineEcheance(dernier, mois)).toBe(attendu);
  });
});

describe("statutEcheance", () => {
  it.each(CAS_STATUT)("$nom", ({ echeance, aujourdhui, seuil, attendu }) => {
    expect(statutEcheance(echeance, aujourdhui, seuil)).toBe(attendu);
  });
});

describe("aujourdhuiParis", () => {
  it("bascule à minuit heure de Paris, pas à minuit UTC", () => {
    // 22 h 30 UTC le 5 octobre = 0 h 30 le 6 octobre à Paris (UTC+2)
    expect(aujourdhuiParis(new Date("2026-10-05T22:30:00Z"))).toBe("2026-10-06");
    // 23 h 30 UTC le 31 décembre = 0 h 30 le 1er janvier à Paris (UTC+1)
    expect(aujourdhuiParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});
