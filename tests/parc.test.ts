import { describe, expect, it } from "vitest";
import { cheminSur, schemaEquipement, statutLePlusUrgent } from "@/lib/metier/parc";

describe("schemaEquipement", () => {
  const base = { code: "TGBT-A", libelle: "Tableau", statut: "en_service" };

  it("normalise les champs facultatifs", () => {
    expect(schemaEquipement.parse({ ...base, famille_id: "", marque: " ", date_mise_en_service: "" })).toMatchObject({
      famille_id: null,
      marque: null,
      date_mise_en_service: null,
    });
  });

  it.each(["TGBT A", "TG/B", "a?b", ""])("refuse le code « %s »", (code) => {
    expect(schemaEquipement.safeParse({ ...base, code }).success).toBe(false);
  });

  it("refuse une mise en service future et un statut inconnu", () => {
    expect(schemaEquipement.safeParse({ ...base, date_mise_en_service: "2099-01-01" }).success).toBe(false);
    expect(schemaEquipement.safeParse({ ...base, statut: "casse" }).success).toBe(false);
  });
});

describe("statutLePlusUrgent", () => {
  it.each([
    [["a_jour", "en_retard", "a_echeance"], "en_retard"],
    [["a_jour", "jamais_controle"], "jamais_controle"],
    [["a_jour", "a_echeance"], "a_echeance"],
    [["a_jour"], "a_jour"],
    [[], null],
  ] as const)("%j → %s", (statuts, attendu) => {
    expect(statutLePlusUrgent([...statuts])).toBe(attendu);
  });
});

describe("cheminSur (redirection après connexion)", () => {
  it.each([
    ["/q/abc123", "/q/abc123"],
    ["/equipements/1?x=2", "/equipements/1?x=2"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["javascript:alert(1)", "/"],
    [null, "/"],
  ])("%s → %s", (entree, attendu) => {
    expect(cheminSur(entree)).toBe(attendu);
  });
});
