import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { lireFichier } from "@/lib/import/fichier";
import {
  lireTableau,
  planifierEquipements,
  type Cellule,
  type Existant,
  type OptionsEquipements,
  type OptionsMaintenance,
  lireFrequence,
} from "@/lib/metier/import";

const VIDE: Existant = {
  familles: [],
  prestataires: [],
  types: [],
  equipements: [],
  plans: [],
  localisations: [],
  univers: [],
};

function planifier(tableau: Cellule[][], options: OptionsEquipements = {}, existant: Existant = VIDE) {
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

  it("toutes les colonnes non associées vont dans les notes avec leur titre, sauf celles exclues", () => {
    const p = planifier(FICHIER, { prefixeCode: "FR-" });
    expect(p.operations.equipements[0].notes).toBe("N° inventaire : INV-100\nService : Gériatrie");
    expect(p.operations.equipements[2].notes).toBeNull();
    const lu = lireTableau(FICHIER, "equipements", undefined, { codeAuto: true, exclues: [4] });
    expect(lu.demande?.exclues).toEqual([4]);
    expect(planifierEquipements(lu.lignes!, VIDE, { prefixeCode: "FR-" }).operations.equipements[0].notes).toBe(
      "N° inventaire : INV-100",
    );
  });

  it("réimport : le n° de série déjà connu rend la ligne « déjà présente » ; même série deux fois : un seul équipement", () => {
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
    expect(doublon.importable).toBe(true);
    expect(doublon.operations.equipements).toHaveLength(1);
    expect(doublon.lignes[1]).toMatchObject({ statut: "ignoree", resume: expect.stringMatching(/ligne 2/) });
  });

  it("préfixe invalide ignoré par la planification (refusé en amont par l'action)", () => {
    const p = planifier(FICHIER, { prefixeCode: "avec espace" });
    expect(p.operations.equipements).toHaveLength(0);
  });
});

describe("tableaux de suivi réels (relevé de maintenance de fauteuils, suivi biomédical)", () => {
  // Reproduit la forme des fichiers fournis (données fictives) : titre de document, en-tête sur deux lignes,
  // codes « ABSENT » ou en double, n° de série suivi d'un commentaire, lignes sans numéro interne.
  const RELEVE: Cellule[][] = [
    ["FAUTEUILS ROULANTS", null, null, null, "MP 2021", null, "MP 2022", null],
    [
      "NUMERO\r\nINTERNE",
      "MARQUE",
      "MODELE",
      "NUMERO DE SERIE",
      "DATE MP 2021",
      "OBSERVATION",
      "DATE MP\r\n2022",
      "VIGILANCE\r\nCASE ROUGE = DANGER IMMINENT\r\nCASE ORANGE = VIGILANCE +++",
      "OBSERVATION",
    ],
    [
      "UG1",
      "INVACARE",
      "Action 2 NG",
      "18GFM001",
      new Date(Date.UTC(2021, 7, 3)),
      "RAS",
      new Date(Date.UTC(2022, 9, 7)),
      "ROUILLE",
      "RESSERRAGE FREIN",
    ],
    ["ABSENT", "VERMEIREN", "D200", "T062", null, null, null, null],
    [
      "ANCIEN\r\nN°157 ?",
      "DRIVE\r\nDEVILBISS",
      "PRIMEO C",
      "D605\r\nPAS DE DEVIS\r\nPLUS DE PIÈCES",
      null,
      null,
      null,
      null,
    ],
    ["UG1", "SUNRISE", "Breezy", "B212", null, null, null, null],
    ["Fauteuil gardé pour pièces détachées", null, null, null, null, null, null, null],
    [null, "INVACARE", "Action 3", "NS ABSENT", null, null, null, null],
    ["TOTAL", 6, null, null, null, null, null, null],
  ];

  it("en-tête sur deux lignes : le groupe précède le titre, raccourci, dans l'association et les notes", () => {
    const lu = lireTableau(RELEVE, "equipements", undefined, { codeAuto: true });
    expect(lu.demande?.ligne).toBe(2);
    expect(lu.demande?.entetes.slice(0, 2)).toEqual(["NUMERO INTERNE", "MARQUE"]);
    expect(lu.demande?.entetes[5]).toBe("MP 2021 · OBSERVATION");
    expect(lu.demande?.entetes[7]).toBe("MP 2022 · VIGILANCE CASE ROUGE = DANGER IMMINENT…");
    const p = planifierEquipements(lu.lignes!, VIDE, { prefixeCode: "FR-" });
    expect(p.operations.equipements[0]).toMatchObject({
      code: "UG1",
      libelle: "INVACARE Action 2 NG",
      notes:
        "MP 2021 · DATE MP 2021 : 03/08/2021\nMP 2021 · OBSERVATION : RAS\nMP 2022 · DATE MP 2022 : 07/10/2022\nMP 2022 · VIGILANCE CASE ROUGE = DANGER IMMINENT… : ROUILLE\nMP 2022 · OBSERVATION : RESSERRAGE FREIN",
    });
    // « OBSERVATION » répété : jamais proposé comme champ « Notes ».
    expect(lu.demande?.champs.find((c) => c.cle === "notes")?.choix).toBeNull();
  });

  it("codes absents, non valides ou en double : code généré, original gardé dans les notes", () => {
    const p = planifier(RELEVE, { prefixeCode: "FR-" });
    expect(p.importable).toBe(true);
    expect(p.operations.equipements.map((e) => e.code)).toEqual(["UG1", "FR-001", "FR-002", "FR-003", "FR-004"]);
    expect(p.operations.equipements[1].notes).toBe("Code d'origine : ABSENT");
    expect(p.operations.equipements[2]).toMatchObject({
      marque: "DRIVE DEVILBISS",
      numero_serie: "D605",
      notes: "Code d'origine : ANCIEN N°157 ?\nN° de série (suite) : PAS DE DEVIS / PLUS DE PIÈCES",
    });
    expect(p.lignes[3].resume).toMatch(/FR-003 \(code généré, « UG1 » en double\)/);
    expect(p.operations.equipements[4]).toMatchObject({ numero_serie: null, notes: "N° de série : NS ABSENT" });
  });

  it("sans préfixe : les mêmes codes bloquent l'import avec une explication", () => {
    const p = planifier(RELEVE);
    expect(p.importable).toBe(false);
    expect(p.lignes[1].erreurs[0]).toMatch(/Code manquant \(« ABSENT »\) : indiquez un préfixe/);
    expect(p.lignes[2].erreurs).toContain("Code : sans espace ni / \\ ? #");
    expect(p.lignes[3].erreurs[0]).toMatch(/« UG1 » en double/);
  });

  it("lignes d'une seule cellule et lignes de total : ignorées, jamais importées", () => {
    const p = planifier(RELEVE, { prefixeCode: "FR-" });
    const ignorees = p.lignes.filter((l) => l.statut === "ignoree").map((l) => l.resume);
    expect(ignorees).toEqual([
      "Ligne d'une seule cellule ignorée (« Fauteuil gardé pour pièces détachées »)",
      "Ligne de total ignorée (« TOTAL »)",
    ]);
  });

  const SUIVI: Cellule[][] = [
    [
      "ID",
      "ID ACTUEL",
      "Marque",
      "Modèle",
      "Numéro de série",
      "État actuel",
      "Date d’acquisition",
      "Guide / Notice",
      "Étage",
      "Dernière maintenance",
    ],
    ["AUTOTENSIOMETRE"],
    [24567, "AND002716", "OMRON", "M6", "SN1", "En service", 2018, "notice.pdf", 1, new Date(Date.UTC(2025, 10, 27))],
    [24568, null, "OMRON", "M6", "SN2", "En maintenance", new Date(Date.UTC(2019, 0, 15)), null, "RDC", null],
    ["POUSSE SERINGUE"],
    [null, null, "FRESENIUS KABI", "AMIKA", "SN3", "Hors service", null, null, null, null],
  ];

  it("suivi biomédical : colonnes reconnues par mots entiers, année seule et statut proche gardés dans les notes", () => {
    const lu = lireTableau(SUIVI, "equipements", undefined, { codeAuto: true });
    const choix = Object.fromEntries(lu.demande!.champs.map((c) => [c.cle, c.choix]));
    // « ID » (et non « Guide / Notice ») pour le code ; « Date d'acquisition » pour la mise en service.
    expect(choix).toMatchObject({
      code: 0,
      marque: 2,
      modele: 3,
      numero_serie: 4,
      statut: 5,
      mise_en_service: 6,
      niveau: 8,
    });
    const p = planifierEquipements(lu.lignes!, VIDE, { prefixeCode: "BIO-", batimentParDefaut: "Principal" });
    expect(p.importable).toBe(true);
    expect(p.operations.equipements[0]).toMatchObject({
      code: "24567",
      libelle: "OMRON M6",
      date_mise_en_service: null,
      statut: "en_service",
      notes:
        "Mise en service : 2018\nID ACTUEL : AND002716\nGuide / Notice : notice.pdf\nDernière maintenance : 27/11/2025",
    });
    expect(p.operations.equipements[1]).toMatchObject({
      date_mise_en_service: "2019-01-15",
      statut: "hors_service",
      notes: "Statut d'origine : En maintenance",
    });
    expect(p.operations.localisations.map((l) => [l.batiment, l.niveau])).toEqual([
      ["Principal", "1"],
      ["Principal", "RDC"],
      ["Principal", null],
    ]);
    expect(p.operations.familles).toEqual([]);
  });

  it("option : les lignes de titre donnent la famille des lignes suivantes", () => {
    const p = planifier(SUIVI, { prefixeCode: "BIO-", batimentParDefaut: "Principal", titresFamille: true });
    expect(p.operations.familles).toEqual(["AUTOTENSIOMETRE", "POUSSE SERINGUE"]);
    expect(p.operations.equipements.map((e) => e.famille)).toEqual([
      { nouveau: "AUTOTENSIOMETRE" },
      { nouveau: "AUTOTENSIOMETRE" },
      { nouveau: "POUSSE SERINGUE" },
    ]);
    expect(p.lignes[0].resume).toMatch(/famille des lignes suivantes/);
  });

  it("sans bâtiment : un étage bloque avec la piste du bâtiment par défaut", () => {
    const p = planifier(SUIVI, { prefixeCode: "BIO-" });
    expect(p.lignes[1].erreurs[0]).toMatch(/bâtiment par défaut/);
  });

  it("notes trop longues : erreur qui indique comment s'en sortir", () => {
    const p = planifier(
      [
        ["Libellé", "Historique"],
        ["Lit", "x".repeat(2100)],
      ],
      { prefixeCode: "L-" },
    );
    expect(p.lignes[0].erreurs[0]).toMatch(/Décochez des colonnes/);
  });
});

describe("classeurs à plusieurs feuilles", () => {
  it("demande la feuille quand plusieurs sont remplies, la lit quand elle est nommée", async () => {
    const contenu = await writeXlsxFile([
      { data: [[{ value: "Code" }], [{ value: "A1" }]], sheet: "Fauteuils" },
      { data: [[{ value: "Code" }], [{ value: "B1" }]], sheet: "Lits" },
    ]).toBuffer();
    const sans = await lireFichier("parc.xlsx", contenu);
    expect(sans.tableaux).toBeUndefined();
    expect(sans.feuilles).toEqual(["Fauteuils", "Lits"]);
    const avec = await lireFichier("parc.xlsx", contenu, ["Lits"]);
    expect(avec.tableaux?.[0].tableau[1][0]).toBe("B1");
    expect((await lireFichier("parc.xlsx", contenu, ["Absente"])).erreur).toMatch(/introuvable/);
    expect((await lireFichier("parc.xlsm", contenu, ["Lits"])).tableaux).toBeDefined();
  });

  it("une seule feuille remplie : lue sans question", async () => {
    const contenu = await writeXlsxFile([
      { data: [[{ value: "Code" }], [{ value: "A1" }]], sheet: "Données" },
      { data: [[]], sheet: "Vide" },
    ]).toBuffer();
    expect((await lireFichier("x.xlsx", contenu)).tableaux?.[0].tableau[1][0]).toBe("A1");
  });
});

describe("maintenances du fichier reprises en contrôles", () => {
  const MAINTENANCE: OptionsMaintenance = {
    libelle: "Maintenance préventive",
    famille: "Maintenance",
    caractere: "interne",
    periodiciteMois: 12,
    conformeSansVigilance: false,
  };
  // Relevé MP : une date par campagne, suivie de sa vigilance et de son observation.
  const RELEVE_MP: Cellule[][] = [
    [null, null, "MP 2024", null, null, "MP 2025", null, null],
    [
      "NUMERO INTERNE",
      "MARQUE",
      "DATE MP 2024",
      "VIGILANCE",
      "OBSERVATION",
      "DATE MP 2025",
      "VIGILANCE",
      "OBSERVATION",
    ],
    [
      "UG1",
      "INVACARE",
      new Date(Date.UTC(2024, 6, 2)),
      "ROUILLE",
      "RAS",
      "17/09/25",
      "- ROUILLE CREMAILLERE\n- FREIN USE",
      "RESSERRAGE",
    ],
    ["UG2", "INVACARE", new Date(Date.UTC(2024, 6, 2)), "RAS", null, "X", null, null],
    ["UG3", "SUNRISE", null, null, null, null, null, null],
  ];

  it("une campagne datée devient un contrôle ; les vigilances de la plus récente, des réserves ouvertes", () => {
    const p = planifier(RELEVE_MP, { maintenance: MAINTENANCE });
    expect(p.importable).toBe(true);
    expect(p.operations.types).toEqual([
      {
        cle: "maintenance|maintenance preventive",
        famille: { nouveau: "Maintenance" },
        libelle: "Maintenance préventive",
        caractere: "interne",
        periodicite_mois: 12,
      },
    ]);
    expect(p.operations.maintenances.map((m) => m.code)).toEqual(["UG1", "UG2"]);
    const [ug1, ug2] = p.operations.maintenances;
    expect(ug1.controles).toEqual([
      {
        date: "2024-07-02",
        resultat: "avec_reserves",
        nb_reserves: 1,
        reserves: [],
        commentaire: "Repris à l'import\nMP 2024 · VIGILANCE : ROUILLE\nMP 2024 · OBSERVATION : RAS",
      },
      {
        date: "2025-09-17",
        resultat: "avec_reserves",
        nb_reserves: 2,
        reserves: ["ROUILLE CREMAILLERE", "FREIN USE"],
        commentaire:
          "Repris à l'import\nMP 2025 · VIGILANCE : - ROUILLE CREMAILLERE\n- FREIN USE\nMP 2025 · OBSERVATION : RESSERRAGE",
      },
    ]);
    // « X » n'est pas une date : la campagne 2025 de UG2 reste dans les notes.
    expect(ug2.controles).toMatchObject([{ date: "2024-07-02", resultat: "conforme", nb_reserves: null }]);
    expect(p.operations.equipements[1].notes).toBe("MP 2025 · DATE MP 2025 : X");
    expect(p.operations.equipements[0].notes).toBeNull();
    expect(p.lignes[0].resume).toMatch(
      /2 maintenances \(dernière le 17\/09\/2025, 2 réserves ouvertes, tous les 12 mois\)/,
    );
  });

  it("sans l'option : tout reste dans les notes, comme avant", () => {
    const p = planifier(RELEVE_MP);
    expect(p.operations.maintenances).toEqual([]);
    expect(p.operations.equipements[0].notes).toMatch(/^MP 2024 · DATE MP 2024 : 02\/07\/2024/);
  });

  // Suivi biomédical : une seule date, sans vigilance, et une périodicité par ligne.
  const SUIVI: Cellule[][] = [
    ["ID", "Marque", "Périodicité maintenance", "Dernière maintenance", "Prochaine maintenance prévue"],
    ["ECG-1", "COLSON", "1 fois / an", new Date(Date.UTC(2025, 9, 6)), new Date(Date.UTC(2026, 9, 1))],
    ["ECG-6", "COLSON", "2 fois / an", "-", new Date(Date.UTC(2026, 9, 1))],
    ["PS-1", "BBRAUN", "2 fois / an", new Date(Date.UTC(2025, 10, 27)), null],
  ];

  it("sans colonne de vigilance : rien sans confirmation explicite, conforme avec", () => {
    expect(planifier(SUIVI, { maintenance: MAINTENANCE }).operations.maintenances).toEqual([]);
    const p = planifier(SUIVI, { maintenance: { ...MAINTENANCE, conformeSansVigilance: true } });
    expect(p.operations.maintenances).toEqual([
      expect.objectContaining({
        code: "ECG-1",
        periodicite_surcharge: null,
        controles: [expect.objectContaining({ date: "2025-10-06", resultat: "conforme" })],
      }),
      expect.objectContaining({ code: "PS-1", periodicite_surcharge: 6 }),
    ]);
    // La périodicité lue passe dans le plan ; la prochaine date prévue reste une information des notes.
    expect(p.operations.equipements[0].notes).toBe("Prochaine maintenance prévue : 01/10/2026");
    expect(p.operations.equipements[1].notes).toBe(
      "Périodicité maintenance : 2 fois / an\nDernière maintenance : -\nProchaine maintenance prévue : 01/10/2026",
    );
  });

  it("type déjà présent (même famille, même libellé) : réutilisé, périodicité différente en surcharge du plan", () => {
    const existant: Existant = {
      ...VIDE,
      familles: [{ id: "f1", libelle: "maintenance" }],
      types: [
        { id: "t1", famille_id: "f1", libelle: "Maintenance préventive", caractere: "interne", periodicite_mois: 6 },
      ],
    };
    const p = planifier(SUIVI, { maintenance: { ...MAINTENANCE, conformeSansVigilance: true } }, existant);
    expect(p.operations.types).toEqual([]);
    expect(p.operations.maintenances.map((m) => [m.type, m.periodicite_surcharge])).toEqual([
      [{ id: "t1" }, 12],
      [{ id: "t1" }, null],
    ]);
  });

  it("fréquences lisibles", () => {
    expect(
      ["1 fois / an", "2 fois par an", "4 fois/an", "tous les 6 mois", "tous les 2 ans", "12", "1 an"].map(
        lireFrequence,
      ),
    ).toEqual([12, 6, 3, 6, 24, 12, 12]);
    expect(lireFrequence("5 fois / an")).toBeNaN();
    expect(lireFrequence("annuel")).toBeNaN();
  });
});

it("plusieurs feuilles : lues ensemble, dans l'ordre demandé", async () => {
  const contenu = await writeXlsxFile([
    { data: [[{ value: "Code" }], [{ value: "A1" }]], sheet: "Fauteuils" },
    { data: [[{ value: "Code" }], [{ value: "B1" }]], sheet: "Lits" },
  ]).toBuffer();
  const lu = await lireFichier("parc.xlsx", contenu, ["Lits", "Fauteuils"]);
  expect(lu.tableaux?.map((t) => [t.feuille, t.tableau[1][0]])).toEqual([
    ["Lits", "B1"],
    ["Fauteuils", "A1"],
  ]);
});
