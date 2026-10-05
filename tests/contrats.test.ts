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

describe("saisie des contrats et prestataires", async () => {
  const { lireMontant, schemaContrat, schemaPrestataire } = await import("@/lib/metier/contrats");
  const UUID = "00000000-0000-4000-a000-000000000001";

  it.each([
    ["1 234,56", 1234.56],
    ["1234.5", 1234.5],
    ["9 600 €", 9600],
    ["", null],
    ["12,345", "invalide"],
    ["-5", "invalide"],
    ["abc", "invalide"],
  ] as const)("montant « %s » → %s", (saisie, attendu) => {
    expect(lireMontant(saisie)).toBe(attendu);
  });

  it("contrat : champs facultatifs, préavis et reconduction", () => {
    const c = schemaContrat.parse({
      prestataire_id: UUID,
      objet: "Maintenance",
      preavis_jours: "90",
      montant_annuel: "4 800",
    });
    expect(c).toMatchObject({ preavis_jours: 90, montant_annuel: 4800, reconduction_tacite: false, date_fin: null });
    expect(
      schemaContrat.parse({ prestataire_id: UUID, objet: "X", reconduction_tacite: "on" }).reconduction_tacite,
    ).toBe(true);
  });

  it("contrat : refuse fin avant début, préavis négatif, montant illisible", () => {
    const base = { prestataire_id: UUID, objet: "X" };
    expect(schemaContrat.safeParse({ ...base, date_debut: "2026-01-01", date_fin: "2025-12-31" }).success).toBe(false);
    expect(schemaContrat.safeParse({ ...base, preavis_jours: "-1" }).success).toBe(false);
    expect(schemaContrat.safeParse({ ...base, montant_annuel: "beaucoup" }).success).toBe(false);
  });

  it("prestataire : mail normalisé, téléphone contrôlé", () => {
    expect(
      schemaPrestataire.parse({ nom: "Élec SA", email: "Contact@Elec.FR", telephone: "01 23 45 67 89" }),
    ).toMatchObject({
      email: "contact@elec.fr",
      telephone: "01 23 45 67 89",
    });
    expect(schemaPrestataire.safeParse({ nom: "X", email: "pas-un-mail" }).success).toBe(false);
    expect(schemaPrestataire.safeParse({ nom: "X", telephone: "appeler Paul" }).success).toBe(false);
  });
});
