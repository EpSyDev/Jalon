import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { genererModele, lireFichier } from "@/lib/import/fichier";
import {
  lireDate,
  lirePeriodicite,
  lireTableau,
  normaliser,
  planifierControles,
  planifierEquipements,
  type Cellule,
  type Existant,
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

const ENTETE_CONTROLES = [
  "Famille",
  "Libellé du contrôle",
  "Périmètre / équipement",
  "Caractère",
  "Périodicité (mois)",
  "Référence du texte",
  "Prestataire",
  "Date du dernier contrôle",
  "Résultat du dernier contrôle",
];

function controles(lignes: Cellule[][], existant: Existant = VIDE) {
  const lu = lireTableau([ENTETE_CONTROLES, ...lignes], "controles");
  if (lu.erreur) throw new Error(lu.erreur);
  return planifierControles(lu.lignes!, existant);
}

describe("lecture du tableau", () => {
  it("reconnaît les en-têtes sans tenir compte des accents ni de la casse", () => {
    const lu = lireTableau(
      [
        [],
        ["FAMILLE", "libelle du controle", "Perimetre / Equipement", "caractere", "periodicite (mois)"],
        ["Élec", "Vérif", "Site", "interne", 12],
      ],
      "controles",
    );
    expect(lu.lignes?.[0]).toMatchObject({ numero: 3, valeurs: { famille: "Élec", periodicite: 12 } });
  });

  it("signale les colonnes obligatoires manquantes", () => {
    expect(
      lireTableau(
        [
          ["Famille", "Libellé du contrôle"],
          ["a", "b"],
        ],
        "controles",
      ).erreur,
    ).toMatch(/Périmètre/);
  });

  it("refuse un fichier vide ou sans données", () => {
    expect(lireTableau([], "controles").erreur).toMatch(/vide/);
    expect(lireTableau([ENTETE_CONTROLES, [null, ""]], "controles").erreur).toMatch(/Aucune ligne/);
  });
});

describe("dates importées", () => {
  it.each([
    ["15/03/2026", "2026-03-15"],
    ["5/3/2026", "2026-03-05"],
    ["2026-03-15", "2026-03-15"],
  ])("« %s » → %s", (entree, attendu) => {
    expect(lireDate(entree).valeur).toBe(attendu);
  });

  it("date Excel (UTC)", () => {
    expect(lireDate(new Date(Date.UTC(2026, 2, 15))).valeur).toBe("2026-03-15");
  });

  it.each(["31/02/2026", "15-03-2026", "demain"])("refuse « %s »", (entree) => {
    expect(lireDate(entree).erreur).toBeDefined();
  });
});

describe("planification des contrôles", () => {
  it("crée familles, prestataires, types et plans, sans doublon de référentiel", () => {
    const p = controles([
      [
        "Électricité",
        "Vérification",
        "Ensemble du site",
        "réglementaire",
        12,
        "Art. X",
        "Élec SA",
        "15/03/2026",
        "conforme",
      ],
      ["electricite", "Vérification", "Bâtiment B", "Réglementaire", "12", "", "ELEC SA", "", ""],
    ]);
    expect(p.importable).toBe(true);
    expect(p.operations.familles).toEqual(["Électricité"]);
    expect(p.operations.prestataires).toEqual(["Élec SA"]);
    expect(p.operations.types).toHaveLength(1);
    expect(p.operations.plans).toHaveLength(2);
    expect(p.operations.plans[0].dernier).toEqual({ date: "2026-03-15", resultat: "conforme" });
    expect(p.operations.plans[1].dernier).toBeNull();
  });

  it("rattache le périmètre à un équipement existant par son code", () => {
    const p = controles([["Élec", "Thermo", "tgbt-a", "interne", 24]], {
      ...VIDE,
      equipements: [{ id: "e1", code: "TGBT-A", numero_serie: null }],
    });
    expect(p.operations.plans[0]).toMatchObject({ equipement_id: "e1", perimetre_libelle: null });
  });

  it("bloque tout l'import à la première erreur, avec le numéro de ligne Excel", () => {
    const p = controles([
      ["Élec", "Vérif", "Site", "interne", 12],
      ["Élec", "Autre", "Site", "recommandé", 0],
    ]);
    expect(p.importable).toBe(false);
    const erreur = p.lignes.find((l) => l.statut === "erreur")!;
    expect(erreur.numero).toBe(3);
    expect(erreur.erreurs.join(" ")).toMatch(/Caractère « recommandé » inconnu/);
    expect(erreur.erreurs.join(" ")).toMatch(/Périodicité/);
  });

  it.each([
    [["Élec", "V", "Site", "interne", "12.5"], /Périodicité/],
    [["Élec", "V", "Site", "interne", 12, "", "", "01/01/2099", "conforme"], /futur/],
    [["Élec", "V", "Site", "interne", 12, "", "", "01/01/2026", ""], /Résultat .* manquant/],
    [["Élec", "V", "Site", "interne", 12, "", "", "", "conforme"], /sans date/],
    [["Élec", "V", "Site", "interne", 12, "", "", "01/01/2026", "bof"], /Résultat « bof » inconnu/],
  ] as [Cellule[], RegExp][])("refuse une ligne invalide (%#)", (ligne, motif) => {
    const p = controles([ligne]);
    expect(p.importable).toBe(false);
    expect(p.lignes[0].erreurs.join(" ")).toMatch(motif);
  });

  it("refuse les doublons dans le fichier et les incohérences de périodicité", () => {
    const p = controles([
      ["Élec", "V", "Site", "interne", 12],
      ["Élec", "V", "Site", "interne", 12],
      ["Élec", "V", "Bât B", "interne", 6],
    ]);
    expect(p.lignes.map((l) => l.statut)).toEqual(["creation", "erreur", "erreur"]);
  });

  it("ne modifie jamais un type existant en silence", () => {
    const existant = {
      ...VIDE,
      familles: [{ id: "f1", libelle: "Électricité" }],
      types: [{ id: "t1", famille_id: "f1", libelle: "Vérif", caractere: "interne", periodicite_mois: 12 }],
    };
    const p = controles([["Electricité", "vérif", "Site", "interne", 6]], existant);
    expect(p.importable).toBe(false);
    expect(p.lignes[0].erreurs[0]).toMatch(/existe déjà avec une périodicité de 12 mois/);
  });

  it("réimporter le même fichier ignore les plans déjà présents", () => {
    const existant = {
      ...VIDE,
      familles: [{ id: "f1", libelle: "Électricité" }],
      types: [{ id: "t1", famille_id: "f1", libelle: "Vérif", caractere: "interne", periodicite_mois: 12 }],
      plans: [{ type_controle_id: "t1", equipement_id: null, perimetre_libelle: "Ensemble du site" }],
    };
    const p = controles([["Électricité", "Vérif", "ensemble du site", "interne", 12]], existant);
    expect(p.lignes[0].statut).toBe("ignoree");
    expect(p.importable).toBe(false); // rien à importer
  });
});

describe("planification des équipements", () => {
  const ENTETE = ["Code", "Libellé", "Famille", "Bâtiment", "Niveau", "Local", "Statut", "Mise en service"];
  const planifier = (lignes: Cellule[][], existant: Existant = VIDE) =>
    planifierEquipements(lireTableau([ENTETE, ...lignes], "equipements").lignes!, existant);

  it("crée localisations et familles une seule fois", () => {
    const p = planifier([
      ["A1", "Armoire 1", "Électricité", "Bât A", "RDC", "TGBT", "", ""],
      ["A2", "Armoire 2", "electricite", "bât a", "rdc", "tgbt", "hors service", "01/02/2020"],
    ]);
    expect(p.importable).toBe(true);
    expect(p.operations.familles).toHaveLength(1);
    expect(p.operations.localisations).toHaveLength(1);
    expect(p.operations.equipements.map((e) => e.statut)).toEqual(["en_service", "hors_service"]);
  });

  it("ignore les codes existants et refuse les doublons du fichier", () => {
    const p = planifier(
      [
        ["A1", "Armoire 1"],
        ["B1", "Pompe"],
        ["b1", "Pompe bis"],
      ],
      { ...VIDE, equipements: [{ id: "e1", code: "a1", numero_serie: null }] },
    );
    expect(p.lignes.map((l) => l.statut)).toEqual(["ignoree", "creation", "erreur"]);
  });

  it("exige le bâtiment si niveau ou local est rempli", () => {
    expect(planifier([["A1", "X", "", "", "R+1", ""]]).lignes[0].erreurs[0]).toMatch(/Bâtiment obligatoire/);
  });

  it("univers : rattache à l'existant (accents, casse, ponctuation), sinon crée une seule fois", () => {
    const lu = lireTableau(
      [
        ["Code", "Libellé", "Univers"],
        ["C1", "Centrale", "chauffage ventilation"],
        ["E1", "Armoire", "Électricité"],
        ["E2", "Armoire 2", "ELECTRICITE"],
        ["S1", "Sans univers", ""],
      ],
      "equipements",
    );
    const p = planifierEquipements(lu.lignes!, { ...VIDE, univers: [{ id: "u1", libelle: "Chauffage-ventilation" }] });
    expect(p.operations.univers).toEqual(["Électricité"]);
    expect(p.operations.equipements.map((e) => e.univers)).toEqual([
      { id: "u1" },
      { nouveau: "Électricité" },
      { nouveau: "Électricité" },
      null,
    ]);
  });

  it("refuse en ligne (et non à l'enregistrement) les textes trop longs et les codes avec espace", () => {
    const p = planifier([
      ["A 1", "X"],
      ["A2", "X", "", "Bât", "N".repeat(61)],
    ]);
    expect(p.lignes[0].erreurs).toContain("Code : sans espace ni / \\ ? #");
    expect(p.lignes[1].erreurs).toContain("Niveau : 60 caractères maximum");
    expect(p.importable).toBe(false);
  });
});

describe("fichiers", () => {
  it("lit un classeur xlsx, dates comprises", async () => {
    const fichier = await writeXlsxFile([
      [{ value: "Code" }, { value: "Libellé" }, { value: "Mise en service" }],
      [
        { value: "A1" },
        { value: "Armoire" },
        { value: new Date(Date.UTC(2020, 1, 1)), type: Date, format: "dd/mm/yyyy" },
      ],
    ]).toBuffer();
    const { tableaux } = await lireFichier("parc.xlsx", fichier);
    const tableau = tableaux?.[0].tableau;
    const lu = lireTableau(tableau!, "equipements");
    expect(planifierEquipements(lu.lignes!, VIDE).operations.equipements[0]).toMatchObject({
      code: "A1",
      date_mise_en_service: "2020-02-01",
    });
  });

  it("lit un CSV Excel (point-virgule, BOM UTF-8)", async () => {
    const csv = "﻿Code;Libellé;Bâtiment\nA1;Armoire « principale »;Bât A\n";
    const { tableaux } = await lireFichier("parc.csv", Buffer.from(csv, "utf8"));
    const tableau = tableaux?.[0].tableau;
    expect(tableau![1]).toEqual(["A1", "Armoire « principale »", "Bât A"]);
  });

  it("refuse un faux xlsx, un CSV mal encodé et les autres formats", async () => {
    expect((await lireFichier("x.xlsx", Buffer.from("pas un zip"))).erreur).toMatch(/pas un classeur/);
    expect((await lireFichier("x.csv", Buffer.from([0x43, 0xe9, 0x3b]))).erreur).toMatch(/UTF-8/);
    expect((await lireFichier("x.xls", Buffer.from("a"))).erreur).toMatch(/.xls ne sont pas lus/);
    expect((await lireFichier("x.ods", Buffer.from("a"))).erreur).toMatch(/non pris en charge/);
  });

  it("le modèle généré est relisible et reconnu", async () => {
    for (const type of ["controles", "equipements"] as const) {
      const { tableaux } = await lireFichier("modele.xlsx", await genererModele(type));
      const tableau = tableaux?.[0].tableau;
      expect(tableau![0].length).toBeGreaterThan(5);
      expect(lireTableau([...tableau!, ["x", "y"]], type).erreur).toBeUndefined();
    }
  });
});

it("normaliser", () => {
  expect(normaliser("  Électricité / Bâtiment-B ")).toBe("electricite batiment b");
});

describe("association des colonnes", () => {
  it("devine des en-têtes différents de ceux du modèle", () => {
    const tableau: Cellule[][] = [
      ["Liste des contrôles du site", null, null],
      ["Domaine", "Vérification", "Installation", "Obligation", "Fréquence", "Entreprise"],
      ["Électricité", "Vérification électrique", "Site", "réglementaire", "12 mois", "Élec SA"],
    ];
    const lu = lireTableau(tableau, "controles");
    expect(lu.erreur).toBeUndefined();
    expect(lu.lignes?.[0]).toMatchObject({ numero: 3, valeurs: { famille: "Électricité", periodicite: "12 mois" } });
  });

  it("choisit la ligne d'en-têtes malgré un titre au-dessus", () => {
    const lu = lireTableau(
      [
        [null],
        ["Titre du document"],
        ["Famille", "Libellé du contrôle", "Périmètre", "Caractère", "Périodicité"],
        ["a", "b", "c", "interne", 6],
      ],
      "controles",
    );
    expect(lu.lignes).toHaveLength(1);
  });

  it("demande une association quand une colonne obligatoire est introuvable, avec des propositions", () => {
    const lu = lireTableau(
      [
        ["Machin", "Truc", "Domaine"],
        ["a", "b", "c"],
      ],
      "controles",
    );
    expect(lu.erreur).toBeDefined();
    expect(lu.demande?.entetes).toEqual(["Machin", "Truc", "Domaine"]);
    expect(lu.demande?.champs.find((c) => c.cle === "famille")?.choix).toBe(2);
    expect(lu.demande?.champs.find((c) => c.cle === "periodicite")?.choix).toBeNull();
  });

  it("applique l'association choisie par l'utilisateur", () => {
    const tableau: Cellule[][] = [
      ["A", "B", "C", "D", "E"],
      ["Élec", "Vérif", "Site", "interne", 12],
    ];
    const lu = lireTableau(tableau, "controles", {
      famille: 0,
      libelle: 1,
      perimetre: 2,
      caractere: 3,
      periodicite: 4,
    });
    expect(lu.lignes?.[0].valeurs).toMatchObject({ famille: "Élec", periodicite: 12 });
  });

  it.each([
    ["12", 12],
    ["12 mois", 12],
    ["1 an", 12],
    ["2 ans", 24],
    ["annuel", NaN],
    ["", NaN],
  ])("périodicité « %s »", (saisie, attendu) => {
    expect(lirePeriodicite(saisie === "" ? null : saisie)).toBe(attendu);
  });
});
