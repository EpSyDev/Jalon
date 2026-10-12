import { describe, expect, it } from "vitest";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  cheminSur,
  filtrerEtCompter,
  filtreStatutValide,
  schemaEquipement,
  schemaModificationGroupee,
  schemaStatut,
  statutLePlusUrgent,
  statutsDuFiltre,
} from "@/lib/metier/parc";

describe("schemaEquipement", () => {
  const base = { code: "TGBT-A", libelle: "Tableau", statut: "en_service" };

  it("normalise les champs facultatifs", () => {
    expect(schemaEquipement.parse({ ...base, categorie_id: "", marque: " ", date_mise_en_service: "" })).toMatchObject({
      categorie_id: null,
      categorie_nouvelle: null,
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

describe("modification groupée", () => {
  const ID = "00000000-0000-4000-a000-0000000000aa";
  const U = "00000000-0000-4000-a000-0000000000bb";

  it("n'écrit que les champs modifiés ; « aucun » retire le rattachement", () => {
    expect(schemaModificationGroupee.parse({ ids: [ID, ID], univers_id: U, localisation_id: "", statut: "" })).toEqual({
      ids: [ID],
      modifications: { univers_id: U },
    });
    expect(schemaModificationGroupee.parse({ ids: [ID], localisation_id: "aucun", statut: "reforme" })).toEqual({
      ids: [ID],
      modifications: { localisation_id: null, statut: "reforme" },
    });
  });

  it("refuse une sélection vide, une modification vide ou une valeur inconnue", () => {
    expect(schemaModificationGroupee.safeParse({ ids: [], univers_id: U }).success).toBe(false);
    expect(schemaModificationGroupee.safeParse({ ids: [ID] }).success).toBe(false);
    expect(schemaModificationGroupee.safeParse({ ids: [ID], statut: "detruit" }).success).toBe(false);
    expect(schemaModificationGroupee.safeParse({ ids: ["1; drop table"], univers_id: U }).success).toBe(false);
  });
});

describe("filtres et facettes de la liste", () => {
  const C1 = "c1";
  const lignes = [
    { id: "a", statut: "en_service", categorie_id: C1, localisation_id: "l1" },
    { id: "b", statut: "reparation_externe", categorie_id: C1, localisation_id: null },
    { id: "c", statut: "reforme", categorie_id: null, localisation_id: "l1" },
    { id: "d", statut: "en_service", categorie_id: null, localisation_id: "l1" },
  ] as const;

  it("sans filtre : le matériel en parc, retirés exclus mais comptés", () => {
    const f = filtrerEtCompter([...lignes], {});
    expect(f.ids).toEqual(["a", "b", "d"]);
    expect(f.statuts).toMatchObject({ en_service: 2, reparation_externe: 1, reforme: 1, declasse: 0 });
    expect(f.categories).toEqual({ c1: 2, aucun: 1 });
    expect(f.localisations).toEqual({ l1: 2, aucun: 1 });
  });

  it("chaque facette compte avec les autres filtres, pas le sien", () => {
    const f = filtrerEtCompter([...lignes], { categorie: C1, statut: "indisponibles" });
    expect(f.ids).toEqual(["b"]);
    expect(f.statuts).toMatchObject({ en_service: 1, reparation_externe: 1 });
    expect(f.categories).toEqual({ c1: 1 });
    expect(filtrerEtCompter([...lignes], { categorie: "aucun", statut: "tous" }).ids).toEqual(["c", "d"]);
    expect(filtrerEtCompter([...lignes], { statut: "retires" }).ids).toEqual(["c"]);
  });

  it("filtre de statut inconnu ignoré", () => {
    expect(filtreStatutValide("casse")).toBeUndefined();
    expect(filtreStatutValide("declasse")).toBe("declasse");
    expect(statutsDuFiltre(undefined)).not.toContain("reforme");
  });
});

describe("schemaStatut", () => {
  const P = "00000000-0000-4000-a000-0000000000cc";

  it("efface les précisions sans objet et date du jour par défaut", () => {
    expect(
      schemaStatut.parse({
        statut: "en_service",
        statut_depuis: "",
        statut_prestataire_id: P,
        statut_retour_prevu: "2026-01-01",
        creer_intervention: "on",
      }),
    ).toMatchObject({
      statut_depuis: aujourdhuiParis(),
      statut_prestataire_id: null,
      statut_retour_prevu: null,
      creer_intervention: false,
    });
    expect(
      schemaStatut.parse({ statut: "reparation_externe", statut_prestataire_id: P, creer_intervention: "on" }),
    ).toMatchObject({ statut_prestataire_id: P, creer_intervention: true });
  });

  it("refuse un début futur et un retour avant le début", () => {
    expect(schemaStatut.safeParse({ statut: "indisponible", statut_depuis: "2099-01-01" }).success).toBe(false);
    expect(
      schemaStatut.safeParse({ statut: "indisponible", statut_depuis: "2026-01-10", statut_retour_prevu: "2026-01-09" })
        .success,
    ).toBe(false);
  });

  it("une catégorie existante ou une nouvelle, pas les deux", () => {
    const base = { code: "X1", libelle: "X", statut: "en_service" };
    expect(schemaEquipement.safeParse({ ...base, categorie_id: P, categorie_nouvelle: "Lits" }).success).toBe(false);
    expect(schemaEquipement.parse({ ...base, categorie_nouvelle: " Lits " })).toMatchObject({
      categorie_nouvelle: "Lits",
    });
  });
});
