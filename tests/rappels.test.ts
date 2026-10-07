import { describe, expect, it } from "vitest";
import {
  aEnregistrer,
  calculerRappels,
  cleRappel,
  libelleReserve,
  normaliserSeuils,
  seuilAtteint,
  type EntreeRappels,
} from "@/lib/metier/rappels";

// 2026-10-05 est un lundi, 2026-10-06 un mardi.
const MARDI = "2026-10-06";
const LUNDI = "2026-10-05";

const base = (surcharge: Partial<EntreeRappels> = {}): EntreeRappels => ({
  aujourdhui: MARDI,
  seuils: [60, 30, 7],
  jourRecap: 1,
  plans: [],
  contrats: [],
  reserves: [],
  dejaEnvoyes: new Set(),
  ...surcharge,
});

const plan = (
  id: string,
  echeance: string | null,
  statut: EntreeRappels["plans"][number]["statut"] = "a_echeance",
) => ({
  id,
  libelle: `Plan ${id}`,
  perimetre: "Site",
  echeance,
  statut,
});

describe("seuilAtteint", () => {
  it.each([
    ["2026-12-05", "J60"], // J-60 pile
    ["2026-12-06", null], // J-61
    ["2026-11-05", "J30"],
    ["2026-10-13", "J7"],
    ["2026-10-06", "J7"], // échéance du jour
    ["2026-10-05", null], // en retard : relève du récapitulatif
  ])("échéance %s → %s", (echeance, attendu) => {
    expect(seuilAtteint(echeance, MARDI, [60, 30, 7])).toBe(attendu);
  });
});

describe("calculerRappels", () => {
  it("un rappel par objet, au seuil le plus urgent", () => {
    const r = calculerRappels(
      base({ plans: [plan("a", "2026-10-10"), plan("b", "2026-11-20"), plan("c", "2027-06-01")] }),
    );
    expect(r.rappels.map((x) => [x.cible_id, x.seuil])).toEqual([
      ["a", "J7"],
      ["b", "J60"],
    ]);
  });

  it("rattrape un passage manqué : à J-25 sans rappel J60, envoie J30 seulement", () => {
    const r = calculerRappels(base({ plans: [plan("a", "2026-10-31")] }));
    expect(r.rappels.map((x) => x.seuil)).toEqual(["J30"]);
  });

  it("aucun doublon sur deux exécutions successives", () => {
    const entree = base({ plans: [plan("a", "2026-10-10")], contrats: [], reserves: [] });
    const premier = calculerRappels(entree);
    const dejaEnvoyes = new Set(aEnregistrer(premier).map(cleRappel));
    const second = calculerRappels({ ...entree, dejaEnvoyes });
    expect(premier.rappels).toHaveLength(1);
    expect(second.rappels).toHaveLength(0);
  });

  it("un nouveau contrôle (nouvelle échéance) ouvre un nouveau cycle", () => {
    const dejaEnvoyes = new Set([
      cleRappel({ cible_type: "plan_controle", cible_id: "a", seuil: "J7", echeance: "2026-10-10" }),
    ]);
    const r = calculerRappels(base({ plans: [plan("a", "2026-11-20")], dejaEnvoyes }));
    expect(r.rappels.map((x) => [x.seuil, x.echeance])).toEqual([["J60", "2026-11-20"]]);
  });

  it("contrats : seuil calculé sur la limite de préavis", () => {
    const r = calculerRappels(
      base({
        contrats: [{ id: "k", objet: "Maintenance", prestataire: "P", date_fin: "2027-01-04", preavis_jours: 90 }],
      }),
    );
    expect(r.rappels[0]).toMatchObject({ cible_type: "contrat", seuil: "J7", echeance: MARDI });
  });

  it("réserves : seuil sur l'échéance de levée", () => {
    const r = calculerRappels(
      base({
        reserves: [
          { id: "r", gravite: "majeure" as const, plan_id: "p", plan_libelle: "Élec", echeance_levee: "2026-10-30" },
        ],
      }),
    );
    expect(r.rappels[0]).toMatchObject({ cible_type: "reserve", seuil: "J30" });
  });

  it("réserves : le libellé du mail ne reprend jamais le texte libre", () => {
    const r = calculerRappels(
      base({
        aujourdhui: LUNDI,
        reserves: [{ id: "r", gravite: null, plan_id: "p", plan_libelle: "Élec", echeance_levee: "2026-10-01" }],
      }),
    );
    expect(r.recap?.lignes[0].libelle).toBe("Réserve — Élec");
    expect(libelleReserve({ gravite: "critique", plan_libelle: "SSI" })).toBe("Réserve critique — SSI");
  });
});

describe("récapitulatif hebdomadaire", () => {
  it("part le lundi même s'il est vide, et pas un autre jour", () => {
    expect(calculerRappels(base({ aujourdhui: LUNDI })).recap).toEqual({ du: LUNDI, lignes: [] });
    expect(calculerRappels(base()).recap).toBeNull();
  });

  it("ne part qu'une fois par lundi", () => {
    const premier = calculerRappels(base({ aujourdhui: LUNDI }));
    const dejaEnvoyes = new Set(aEnregistrer(premier).map(cleRappel));
    expect(calculerRappels(base({ aujourdhui: LUNDI, dejaEnvoyes })).recap).toBeNull();
  });

  it("liste retards, jamais contrôlés, réserves dépassées et contrats échus", () => {
    const r = calculerRappels(
      base({
        aujourdhui: LUNDI,
        plans: [
          plan("a", "2026-09-01", "en_retard"),
          plan("b", null, "jamais_controle"),
          plan("c", "2027-01-01", "a_jour"),
        ],
        reserves: [
          { id: "r", gravite: "majeure" as const, plan_id: "a", plan_libelle: "Élec", echeance_levee: "2026-09-30" },
        ],
        contrats: [{ id: "k", objet: "Ancien contrat", prestataire: "P", date_fin: "2026-09-30", preavis_jours: 30 }],
      }),
    );
    expect(r.recap?.lignes.map((l) => l.detail)).toEqual([
      "en retard depuis le 01/09/2026",
      "jamais contrôlé",
      "réserve à lever depuis le 30/09/2026",
      "contrat échu le 30/09/2026",
    ]);
  });
});

it("normaliserSeuils", () => {
  expect(normaliserSeuils([7, 60, 30, 30, 0, 400, 2.5])).toEqual([60, 30, 7]);
});
