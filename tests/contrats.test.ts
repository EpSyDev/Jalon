import { describe, expect, it } from "vitest";
import { alerteContrat, limitePreavis } from "@/lib/metier/contrats";

const AUJ = "2026-10-06";

describe("limitePreavis", () => {
  it("retranche le préavis de la date de fin", () => {
    expect(limitePreavis("2027-01-31", 90)).toBe("2026-11-02");
    expect(limitePreavis("2027-03-01", 1)).toBe("2027-02-28");
  });

  it("sans préavis, la limite est la date de fin", () => {
    expect(limitePreavis("2027-01-31", null)).toBe("2027-01-31");
    expect(limitePreavis("2027-01-31", 0)).toBe("2027-01-31");
  });
});

describe("alerteContrat", () => {
  it.each([
    { nom: "sans date de fin", date_fin: null, preavis_jours: 90, attendu: null },
    { nom: "échu hier", date_fin: "2026-10-05", preavis_jours: 30, attendu: "echu" },
    { nom: "fin aujourd'hui sans préavis", date_fin: "2026-10-06", preavis_jours: null, attendu: "a_decider" },
    { nom: "limite de préavis dépassée", date_fin: "2026-11-05", preavis_jours: 90, attendu: "preavis_depasse" },
    { nom: "limite de préavis aujourd'hui", date_fin: "2027-01-04", preavis_jours: 90, attendu: "a_decider" },
    { nom: "limite à J+60 pile", date_fin: "2027-03-05", preavis_jours: 90, attendu: "a_decider" },
    { nom: "limite à J+61", date_fin: "2027-03-06", preavis_jours: 90, attendu: null },
    { nom: "fin lointaine", date_fin: "2028-10-06", preavis_jours: 30, attendu: null },
  ])("$nom", ({ date_fin, preavis_jours, attendu }) => {
    expect(alerteContrat({ date_fin, preavis_jours }, AUJ, 60)).toBe(attendu);
  });
});
