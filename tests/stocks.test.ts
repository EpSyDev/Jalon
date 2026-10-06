import { describe, expect, it } from "vitest";
import { formaterQuantite, lireQuantite, schemaArticle, schemaMouvement } from "@/lib/metier/stocks";

describe("stocks", () => {
  it.each([
    ["2,5", 2.5],
    ["1 000", 1000],
    ["0,125", 0.125],
    ["", null],
    ["-1", "invalide"],
    ["1,2345", "invalide"],
  ] as const)("quantité « %s » → %s", (s, attendu) => {
    expect(lireQuantite(s)).toBe(attendu);
  });

  it("article : seuil facultatif", () => {
    expect(schemaArticle.parse({ libelle: "Ampoule", seuil_alerte: "" })).toMatchObject({
      seuil_alerte: null,
      unite: null,
    });
    expect(schemaArticle.parse({ libelle: "Ampoule", seuil_alerte: "10" }).seuil_alerte).toBe(10);
  });

  it("mouvement : quantité strictement positive et date non future", () => {
    const base = { sens: "sortie", quantite: "2", date_mouvement: "2026-01-01" };
    expect(schemaMouvement.safeParse(base).success).toBe(true);
    expect(schemaMouvement.safeParse({ ...base, quantite: "0" }).success).toBe(false);
    expect(schemaMouvement.safeParse({ ...base, date_mouvement: "2099-01-01" }).success).toBe(false);
  });

  it("formatage", () => {
    expect(formaterQuantite("12.500", "m")).toBe("12,5 m");
    expect(formaterQuantite(3)).toBe("3");
  });
});
