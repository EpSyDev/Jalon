import { describe, expect, it } from "vitest";
import { changements, idsLies, lienEnregistrement, titreEnregistrement, valeurLisible } from "@/lib/metier/journal";

describe("journal lisible", () => {
  it("ne montre que les champs modifiés, sans colonnes techniques", () => {
    const avant = {
      id: "x",
      code: "TGBT-A",
      statut: "en_service",
      updated_at: "2026-10-01T08:00:00+00:00",
      actif: true,
    };
    const apres = { ...avant, statut: "hors_service", updated_at: "2026-10-07T08:00:00+00:00", actif: false };
    expect(changements({ action: "update", avant, apres })).toEqual([
      { champ: "Statut", avant: "En service", apres: "Hors service" },
      { champ: "Actif", avant: "oui", apres: "non" },
    ]);
  });

  it("dates en JJ/MM/AAAA ; rattachement signalé sans identifiant brut ; création sans détail", () => {
    const u = "00000000-0000-4000-a000-000000000001";
    expect(
      changements({
        action: "update",
        avant: { date_realisation: "2026-01-31", univers_id: null },
        apres: { date_realisation: "2026-02-28", univers_id: u },
      }),
    ).toEqual([
      { champ: "Date de réalisation", avant: "31/01/2026", apres: "28/02/2026" },
      { champ: "Univers", avant: "—", apres: "autre valeur" },
    ]);
    expect(changements({ action: "insert", avant: null, apres: { code: "A" } })).toEqual([]);
    // Nom de l'élément lié quand il est connu.
    expect(
      changements(
        { action: "update", avant: { univers_id: null }, apres: { univers_id: u } },
        new Map([[u, "Électricité"]]),
      ),
    ).toEqual([{ champ: "Univers", avant: "—", apres: "Électricité" }]);
    expect(idsLies([{ avant: { univers_id: u, code: "x" }, apres: { univers_id: u, localisation_id: null } }])).toEqual(
      [u],
    );
    expect(valeurLisible("x".repeat(100))).toHaveLength(80);
  });

  it("titre et lien de l'élément concerné", () => {
    expect(titreEnregistrement({ enregistrement_id: "1", apres: { code: "CTA-01", libelle: "Centrale" } })).toBe(
      "CTA-01 — Centrale",
    );
    expect(titreEnregistrement({ enregistrement_id: "1", apres: { date_realisation: "2026-10-01" } })).toBe(
      "réalisé le 01/10/2026",
    );
    const plan = "00000000-0000-4000-a000-0000000000aa";
    expect(
      lienEnregistrement({ table_cible: "controles", enregistrement_id: "c", apres: { plan_controle_id: plan } }),
    ).toBe(`/controles/plans/${plan}`);
    expect(lienEnregistrement({ table_cible: "inconnue", enregistrement_id: "c", apres: null })).toBeNull();
  });
});
