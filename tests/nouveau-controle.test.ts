import { describe, expect, it } from "vitest";
import { grouperControles, schemaNouveauControle } from "@/lib/metier/controles";

const F = "00000000-0000-4000-a000-0000000000f1";
const base = { caractere: "interne", libelle: "Vérification", periodicite_mois: "12", perimetre_libelle: "Site" };

describe("schéma « Nouveau contrôle »", () => {
  it("une famille existante OU une nouvelle, jamais aucune ni les deux", () => {
    expect(schemaNouveauControle.safeParse({ ...base, famille_id: F }).success).toBe(true);
    expect(schemaNouveauControle.safeParse({ ...base, famille_nouvelle: "Électricité" }).success).toBe(true);
    expect(schemaNouveauControle.safeParse({ ...base }).success).toBe(false);
    expect(schemaNouveauControle.safeParse({ ...base, famille_id: F, famille_nouvelle: "X" }).success).toBe(false);
  });

  it("équipement ou périmètre obligatoire ; dernier contrôle : résultat requis, jamais dans le futur", () => {
    expect(schemaNouveauControle.safeParse({ ...base, famille_id: F, perimetre_libelle: "" }).success).toBe(false);
    expect(schemaNouveauControle.safeParse({ ...base, famille_id: F, date_dernier: "2026-01-01" }).success).toBe(false);
    expect(
      schemaNouveauControle.safeParse({ ...base, famille_id: F, date_dernier: "2099-01-01", resultat: "conforme" })
        .success,
    ).toBe(false);
    expect(
      schemaNouveauControle.safeParse({ ...base, famille_id: F, date_dernier: "2026-01-01", resultat: "avec_reserves" })
        .success,
    ).toBe(false);
    expect(
      schemaNouveauControle.safeParse({ ...base, famille_id: F, date_dernier: "2026-01-01", resultat: "conforme" })
        .success,
    ).toBe(true);
  });
});

describe("regroupement famille → caractère", () => {
  it("familles par ordre alphabétique, caractères réglementaire → obligatoire → interne", () => {
    const p = (
      famille_id: string,
      famille_libelle: string,
      caractere: "reglementaire" | "obligatoire" | "interne",
    ) => ({
      famille_id,
      famille_libelle,
      caractere,
    });
    const r = grouperControles([
      p("b", "Fluides", "interne"),
      p("a", "Électricité", "interne"),
      p("a", "Électricité", "reglementaire"),
      p("a", "Électricité", "interne"),
    ]);
    expect(r.map((f) => f.famille)).toEqual(["Électricité", "Fluides"]);
    expect(r[0].groupes.map((g) => [g.caractere, g.plans.length])).toEqual([
      ["reglementaire", 1],
      ["interne", 2],
    ]);
  });
});
