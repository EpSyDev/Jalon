import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { lireFichier } from "@/lib/import/fichier";
import { lireTableau, planifierEquipements, type Cellule, type Existant } from "@/lib/metier/import";

const VIDE: Existant = {
  familles: [],
  prestataires: [],
  types: [],
  equipements: [],
  plans: [],
  localisations: [],
  univers: [],
};

function planifier(
  tableau: Cellule[][],
  options: { prefixeCode?: string | null; universParDefaut?: string | null } = {},
  existant: Existant = VIDE,
) {
  const lu = lireTableau(tableau, "equipements", undefined, { codeAuto: Boolean(options.prefixeCode) });
  if (lu.erreur) throw new Error(lu.erreur);
  return planifierEquipements(lu.lignes!, existant, options);
}

describe("import d'équipements sans colonne code (ex. fauteuils roulants)", () => {
  const FICHIER: Cellule[][] = [
    ["Désignation", "Marque", "N° de série", "N° inventaire", "Service"],
    ["Fauteuil manuel 45 cm", "Invacare", "SN-1", "INV-100", "Gériatrie"],
    ["Fauteuil manuel 40 cm", "Invacare", "SN-2", "INV-101", "Gériatrie"],
    ["Fauteuil électrique", "Quickie", null, null, null],
  ];

  it("exige un code, ou un préfixe pour en générer", () => {
    expect(lireTableau(FICHIER, "equipements").erreur).toMatch(/Code/);
    expect(lireTableau(FICHIER, "equipements", undefined, { codeAuto: true }).erreur).toBeUndefined();
  });

  it("génère FR-001… dans l'univers choisi, en sautant les codes déjà pris", () => {
    const p = planifier(
      FICHIER,
      { prefixeCode: "FR-", universParDefaut: "u-fauteuils" },
      {
        ...VIDE,
        equipements: [{ id: "e1", code: "FR-002", numero_serie: null }],
      },
    );
    expect(p.importable).toBe(true);
    expect(p.operations.equipements.map((e) => e.code)).toEqual(["FR-001", "FR-003", "FR-004"]);
    expect(p.operations.equipements.every((e) => "id" in e.univers! && e.univers.id === "u-fauteuils")).toBe(true);
    expect(p.lignes[0].resume).toMatch(/FR-001 \(code généré\)/);
  });

  it("une colonne « univers » remplie l'emporte sur l'univers par défaut", () => {
    const p = planifier(
      [
        ["Code", "Libellé", "Univers"],
        ["A1", "Un", "Biomédical"],
        ["A2", "Deux", ""],
      ],
      { universParDefaut: "u-defaut" },
    );
    expect(p.operations.equipements.map((e) => e.univers)).toEqual([{ nouveau: "Biomédical" }, { id: "u-defaut" }]);
  });

  it("colonnes en plus : reprises dans les notes avec leur titre", () => {
    const lu = lireTableau(
      FICHIER,
      "equipements",
      { libelle: 0, marque: 1, numero_serie: 2, info_1: 3, info_2: 4 },
      { codeAuto: true },
    );
    const p = planifierEquipements(lu.lignes!, VIDE, { prefixeCode: "FR-" });
    expect(p.operations.equipements[0].notes).toBe("N° inventaire : INV-100\nService : Gériatrie");
    expect(p.operations.equipements[2].notes).toBeNull();
  });

  it("réimport : le n° de série déjà connu rend la ligne « déjà présente » ; doublon dans le fichier refusé", () => {
    const existant = { ...VIDE, equipements: [{ id: "e1", code: "FR-001", numero_serie: "sn-1" }] };
    const p = planifier(FICHIER, { prefixeCode: "FR-" }, existant);
    expect(p.lignes.map((l) => l.statut)).toEqual(["ignoree", "creation", "creation"]);
    expect(p.operations.equipements.map((e) => e.code)).toEqual(["FR-002", "FR-003"]);
    const doublon = planifier(
      [
        ["Libellé", "N° de série"],
        ["A", "X1"],
        ["B", "x1"],
      ],
      { prefixeCode: "Z-" },
    );
    expect(doublon.importable).toBe(false);
    expect(doublon.lignes[1].erreurs[0]).toMatch(/en double dans le fichier/);
  });

  it("préfixe invalide ignoré par la planification (refusé en amont par l'action)", () => {
    const p = planifier(FICHIER, { prefixeCode: "avec espace" });
    expect(p.operations.equipements).toHaveLength(0);
  });
});

describe("classeurs à plusieurs feuilles", () => {
  it("demande la feuille quand plusieurs sont remplies, la lit quand elle est nommée", async () => {
    const contenu = await writeXlsxFile([
      { data: [[{ value: "Code" }], [{ value: "A1" }]], sheet: "Fauteuils" },
      { data: [[{ value: "Code" }], [{ value: "B1" }]], sheet: "Lits" },
    ]).toBuffer();
    const sans = await lireFichier("parc.xlsx", contenu);
    expect(sans.tableau).toBeUndefined();
    expect(sans.feuilles).toEqual(["Fauteuils", "Lits"]);
    const avec = await lireFichier("parc.xlsx", contenu, "Lits");
    expect(avec.tableau?.[1][0]).toBe("B1");
    expect((await lireFichier("parc.xlsx", contenu, "Absente")).erreur).toMatch(/introuvable/);
    expect((await lireFichier("parc.xlsm", contenu, "Lits")).tableau).toBeDefined();
  });

  it("une seule feuille remplie : lue sans question", async () => {
    const contenu = await writeXlsxFile([
      { data: [[{ value: "Code" }], [{ value: "A1" }]], sheet: "Données" },
      { data: [[]], sheet: "Vide" },
    ]).toBuffer();
    expect((await lireFichier("x.xlsx", contenu)).tableau?.[1][0]).toBe("A1");
  });
});
