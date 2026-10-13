import { describe, expect, it } from "vitest";
import { schemaEpi, statutEpi } from "@/lib/metier/epi";
import { calculerRappels, seuilsDuPlan, type EntreeRappels } from "@/lib/metier/rappels";

describe("statutEpi", () => {
  it.each([
    [null, "sans_date"],
    ["2026-10-05", "perime"],
    ["2026-10-06", "bientot"],
    ["2026-12-05", "bientot"],
    ["2026-12-06", "ok"],
  ] as const)("péremption %s → %s (aujourd'hui 2026-10-06, seuil 60 jours)", (date, attendu) => {
    expect(statutEpi(date, "2026-10-06", 60)).toBe(attendu);
  });
});

describe("schemaEpi", () => {
  it("quantité 1 par défaut, date facultative, refuse zéro ou un texte", () => {
    expect(schemaEpi.parse({ libelle: "Gants isolants" })).toMatchObject({ quantite: 1, date_peremption: null });
    expect(schemaEpi.parse({ libelle: "Gants", quantite: "4", date_peremption: "2027-03-01" })).toMatchObject({
      quantite: 4,
      date_peremption: "2027-03-01",
    });
    expect(schemaEpi.safeParse({ libelle: "Gants", quantite: "0" }).success).toBe(false);
    expect(schemaEpi.safeParse({ libelle: "", quantite: "1" }).success).toBe(false);
  });
});

describe("rappels : EPI et contrôles mensuels", () => {
  const base = (s: Partial<EntreeRappels> = {}): EntreeRappels => ({
    aujourdhui: "2026-10-06",
    seuils: [60, 30, 7],
    jourRecap: 1,
    plans: [],
    contrats: [],
    reserves: [],
    dejaEnvoyes: new Set(),
    ...s,
  });

  it("seuils d'un contrôle : seulement ceux plus courts que sa période", () => {
    expect(seuilsDuPlan([60, 30, 7], 1)).toEqual([7]);
    expect(seuilsDuPlan([60, 30, 7], 12)).toEqual([60, 30, 7]);
    expect(seuilsDuPlan([60, 30], 1)).toEqual([30]);
    expect(seuilsDuPlan([60, 30, 7])).toEqual([60, 30, 7]);
  });

  it("essai mensuel : rien au lendemain du dernier essai, un rappel à J-7", () => {
    const plan = (echeance: string) => ({
      id: "g",
      libelle: "Essai en charge mensuel",
      perimetre: "GE-1",
      echeance,
      statut: "a_jour" as const,
      periodicite_mois: 1,
    });
    expect(calculerRappels(base({ plans: [plan("2026-11-05")] })).rappels).toEqual([]);
    expect(calculerRappels(base({ plans: [plan("2026-10-12")] })).rappels.map((r) => r.seuil)).toEqual(["J7"]);
  });

  it("EPI : rappel avant péremption, périmés au récapitulatif, sans date ignoré", () => {
    const epi = [
      { id: "a", libelle: "Gants isolants", quantite: 4, date_peremption: "2026-11-20" },
      { id: "b", libelle: "Casque", quantite: 1, date_peremption: "2026-09-01" },
      { id: "c", libelle: "Lunettes", quantite: 2, date_peremption: null },
    ];
    const r = calculerRappels(base({ epi, aujourdhui: "2026-10-05" }));
    expect(r.rappels.filter((x) => x.cible_type === "epi").map((x) => [x.cible_id, x.seuil, x.detail])).toEqual([
      ["a", "J60", "4 pièces · péremption le 20/11/2026"],
    ]);
    expect(r.recap?.lignes.map((l) => `${l.libelle} — ${l.detail}`)).toContain(
      "EPI : Casque — périmé depuis le 01/09/2026",
    );
  });
});
