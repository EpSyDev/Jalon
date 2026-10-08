import { describe, expect, it } from "vitest";
import { lireTableau, planifierEquipements } from "@/lib/metier/import";
import { masquerNoms } from "@/lib/metier/noms";

it("import : les noms des cellules sont masqués avant d'entrer dans Jalon", () => {
  const lu = lireTableau(
    [
      ["Code", "Marque", "Affecté à"],
      ["DICT-7", "VOXEO", "Dr ROGER"],
    ],
    "equipements",
  );
  const p = planifierEquipements(lu.lignes!, {
    familles: [],
    prestataires: [],
    types: [],
    equipements: [],
    plans: [],
    localisations: [],
    univers: [],
  });
  expect(p.operations.equipements[0].notes).toBe("Affecté à : Dr R.");
});

describe("masquage des noms", () => {
  it("garde seulement l'initiale après un titre", () => {
    expect(masquerNoms("Dr ROGER")).toBe("Dr R.");
    expect(masquerNoms("IPA Edwige GUERIN")).toBe("IPA E. G.");
    expect(masquerNoms("A l'attention de M. SCHMITT")).toBe("A l'attention de M. S.");
    expect(masquerNoms("Mme Le-Gall, cadre")).toBe("Mme L., cadre");
    expect(masquerNoms("Vu avec DR HAOUI et Docteur Jean DUPONT ce jour")).toBe(
      "Vu avec DR H. et Docteur J. D. ce jour",
    );
  });

  it("laisse intacts les textes sans nom précédé d'un titre", () => {
    for (const t of [
      "Médecin intérim",
      "OMRON M6",
      "HDJ RDC",
      "TZARA",
      "PRESENCE ROUILLE",
      "Dr.",
      "classe IIb",
      "Dr intérim",
    ]) {
      expect(masquerNoms(t)).toBe(t);
    }
  });
});
