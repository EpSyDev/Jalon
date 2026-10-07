import { describe, expect, it } from "vitest";
import { interventionEnRetard, messageRetardChantier, retardChantier } from "@/lib/metier/retards";
import { etatSauvegarde, messageSauvegarde } from "@/lib/metier/sauvegarde";

const AUJ = "2026-10-07";

describe("retards", () => {
  it("intervention : retard seulement si non terminée et date prévue strictement passée", () => {
    expect(interventionEnRetard({ statut: "a_faire", date_prevue: "2026-10-06" }, AUJ)).toBe(true);
    expect(interventionEnRetard({ statut: "en_cours", date_prevue: AUJ }, AUJ)).toBe(false);
    expect(interventionEnRetard({ statut: "terminee", date_prevue: "2026-01-01" }, AUJ)).toBe(false);
    expect(interventionEnRetard({ statut: "a_faire", date_prevue: null }, AUJ)).toBe(false);
  });

  it("chantier : fin prévue dépassée, ou prévu alors que le début est passé", () => {
    const c = (statut: string, date_debut: string | null, date_fin_prevue: string | null) =>
      retardChantier({ statut, date_debut, date_fin_prevue }, AUJ);
    expect(c("en_cours", "2026-09-01", "2026-10-01")).toBe("fin_depassee");
    expect(c("suspendu", null, "2026-10-06")).toBe("fin_depassee");
    expect(c("prevu", "2026-10-01", "2026-12-01")).toBe("debut_depasse");
    expect(c("en_cours", "2026-10-01", "2026-12-01")).toBeNull();
    expect(c("termine", "2026-01-01", "2026-02-01")).toBeNull();
    expect(c("prevu", AUJ, AUJ)).toBeNull();
  });

  it("messages en français avec le nombre de jours", () => {
    expect(messageRetardChantier({ date_debut: null, date_fin_prevue: "2026-10-06" }, "fin_depassee", AUJ)).toBe(
      "Fin prévue le 06/10/2026 (depuis 1 jour)",
    );
    expect(messageRetardChantier({ date_debut: "2026-10-02", date_fin_prevue: null }, "debut_depasse", AUJ)).toBe(
      "Devait démarrer le 02/10/2026 (depuis 5 jours)",
    );
  });
});

describe("fraîcheur de la sauvegarde", () => {
  it("jamais, récente, ancienne (seuil 7 jours, date de Paris)", () => {
    expect(etatSauvegarde(null, AUJ)).toEqual({ niveau: "jamais" });
    expect(etatSauvegarde("n'importe quoi", AUJ)).toEqual({ niveau: "jamais" });
    expect(etatSauvegarde("2026-09-30T10:00:00.000Z", AUJ)).toEqual({ niveau: "ok", jours: 7 });
    expect(etatSauvegarde("2026-09-29T10:00:00.000Z", AUJ)).toEqual({ niveau: "ancienne", jours: 8 });
    // 22 h 30 UTC le 6 = 00 h 30 à Paris le 7 : sauvegarde du jour.
    expect(etatSauvegarde("2026-10-06T22:30:00.000Z", AUJ)).toEqual({ niveau: "ok", jours: 0 });
  });

  it("message seulement quand il faut agir", () => {
    expect(messageSauvegarde({ niveau: "ok", jours: 3 })).toBeNull();
    expect(messageSauvegarde({ niveau: "jamais" })).toMatch(/jamais/);
    expect(messageSauvegarde({ niveau: "ancienne", jours: 12 })).toMatch(/12 jours/);
  });
});
