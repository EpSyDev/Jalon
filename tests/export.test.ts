import { describe, expect, it } from "vitest";
import { lireFichier } from "@/lib/import/fichier";
import { genererTableur } from "@/lib/export";

describe("export Excel", () => {
  it("relu à l'identique : dates sans décalage, nombres, cellules vides, texte jamais en formule", async () => {
    const contenu = await genererTableur(
      "Échéances",
      [{ entete: "Contrôle" }, { entete: "Échéance", type: "date" }, { entete: "Mois", type: "nombre" }],
      [
        ['=HYPERLINK("x")', "2026-03-29", 12],
        ["SSI", null, null],
      ],
    );
    const { tableau, erreur } = await lireFichier("export.xlsx", contenu);
    expect(erreur).toBeUndefined();
    expect(tableau![0]).toEqual(["Contrôle", "Échéance", "Mois"]);
    expect(tableau![1][0]).toBe('=HYPERLINK("x")');
    expect((tableau![1][1] as Date).toISOString().slice(0, 10)).toBe("2026-03-29");
    expect(tableau![1][2]).toBe(12);
    expect(tableau![2].slice(0, 1)).toEqual(["SSI"]);
  });
});
