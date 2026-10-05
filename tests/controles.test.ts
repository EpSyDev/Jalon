import { describe, expect, it } from "vitest";
import {
  incoherenceResultat,
  premierMessage,
  schemaControle,
  schemaPlanControle,
  schemaReserve,
  schemaTypeControle,
} from "@/lib/metier/controles";

const UUID = "00000000-0000-4000-a000-000000000001";

describe("saisie d'un contrôle", () => {
  const base = {
    plan_controle_id: UUID,
    date_realisation: "2026-10-06",
    resultat: "conforme",
    nb_reserves_declare: "0",
  };

  it("accepte une saisie minimale et normalise les champs vides", () => {
    const r = schemaControle.parse({ ...base, reference_rapport: "  ", commentaire: "" });
    expect(r).toMatchObject({ nb_reserves_declare: 0, reference_rapport: null, commentaire: null });
  });

  it("refuse une date mal formée", () => {
    expect(schemaControle.safeParse({ ...base, date_realisation: "06/10/2026" }).success).toBe(false);
  });

  it("refuse un nombre de réserves négatif ou décimal", () => {
    expect(schemaControle.safeParse({ ...base, resultat: "avec_reserves", nb_reserves_declare: "-1" }).success).toBe(
      false,
    );
    expect(schemaControle.safeParse({ ...base, resultat: "avec_reserves", nb_reserves_declare: "1.5" }).success).toBe(
      false,
    );
  });

  it("vérifie la cohérence résultat / réserves", () => {
    expect(incoherenceResultat("conforme", 0)).toBeNull();
    expect(incoherenceResultat("conforme", 2)).toMatch(/conforme/);
    expect(incoherenceResultat("avec_reserves", 0)).toMatch(/nombre/);
    expect(incoherenceResultat("avec_reserves", 3)).toBeNull();
    expect(incoherenceResultat("non_conforme", 0)).toBeNull();
    const r = schemaControle.safeParse({ ...base, nb_reserves_declare: "2" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(premierMessage(r.error, { nb_reserves_declare: "Nombre de réserves" })).toMatch(/^Nombre de réserves : /);
  });

  it("limite la longueur des champs libres", () => {
    expect(schemaControle.safeParse({ ...base, commentaire: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("type de contrôle", () => {
  const base = { libelle: "Vérification", famille_id: UUID, caractere: "reglementaire", periodicite_mois: "12" };

  it("convertit la périodicité saisie", () => {
    expect(schemaTypeControle.parse(base).periodicite_mois).toBe(12);
  });

  it.each(["0", "121", "6.5", "", "abc"])("refuse la périodicité « %s »", (p) => {
    expect(schemaTypeControle.safeParse({ ...base, periodicite_mois: p }).success).toBe(false);
  });

  it("n'accepte aucun caractère hors liste", () => {
    expect(schemaTypeControle.safeParse({ ...base, caractere: "recommande" }).success).toBe(false);
  });
});

describe("plan de contrôle", () => {
  const base = { type_controle_id: UUID, equipement_id: "", perimetre_libelle: "Site", actif: "on" };

  it("exige un équipement ou un périmètre", () => {
    expect(schemaPlanControle.safeParse({ ...base, perimetre_libelle: "" }).success).toBe(false);
    expect(schemaPlanControle.safeParse({ ...base, perimetre_libelle: "", equipement_id: UUID }).success).toBe(true);
  });

  it("surcharge facultative et case « actif » décochée", () => {
    const r = schemaPlanControle.parse({ ...base, periodicite_mois_surcharge: "", actif: undefined });
    expect(r).toMatchObject({ periodicite_mois_surcharge: null, actif: false, prestataire_id: null });
    expect(schemaPlanControle.parse({ ...base, periodicite_mois_surcharge: "6" }).periodicite_mois_surcharge).toBe(6);
  });
});

describe("réserve", () => {
  it("gravité et échéance facultatives", () => {
    expect(schemaReserve.parse({ description: "Câble à reprendre", gravite: "", echeance_levee: "" })).toMatchObject({
      gravite: null,
      echeance_levee: null,
    });
  });

  it("description obligatoire", () => {
    expect(schemaReserve.safeParse({ description: "   " }).success).toBe(false);
  });
});

describe("levée de réserve", () => {
  it("refuse une date future", async () => {
    const { schemaLeveeReserve } = await import("@/lib/metier/controles");
    expect(schemaLeveeReserve.safeParse({ date_levee: "2099-01-01" }).success).toBe(false);
    expect(schemaLeveeReserve.safeParse({ date_levee: "2020-01-01" }).success).toBe(true);
  });
});
