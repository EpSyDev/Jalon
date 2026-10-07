import { describe, expect, it } from "vitest";
import {
  formaterValeur,
  horsSeuil,
  libelleSeuils,
  lireNombre,
  prochainReleve,
  schemaPointReleve,
  schemaReleve,
  statutReleve,
} from "@/lib/metier/releves";

const AUJ = "2026-10-07";

describe("statut d'un relevé", () => {
  it("jamais, en retard à partir du lendemain de l'échéance, du jour, à jour", () => {
    expect(statutReleve(null, 7, AUJ)).toBe("jamais");
    expect(statutReleve("2026-09-29", 7, AUJ)).toBe("en_retard"); // échéance le 06/10
    expect(statutReleve("2026-09-30", 7, AUJ)).toBe("du_jour"); // échéance le 07/10
    expect(statutReleve("2026-10-01", 7, AUJ)).toBe("a_jour");
    expect(prochainReleve("2026-02-27", 2)).toBe("2026-03-01"); // fin de février
    expect(prochainReleve(null, 7)).toBeNull();
  });
});

describe("seuils", () => {
  it("les bornes sont acceptées ; bas et haut détectés ; sans seuil jamais de dépassement", () => {
    expect(horsSeuil(5, 5, 10)).toBeNull();
    expect(horsSeuil(10, 5, 10)).toBeNull();
    expect(horsSeuil(4.99, 5, 10)).toBe("bas");
    expect(horsSeuil(10.01, 5, 10)).toBe("haut");
    expect(horsSeuil(-50, null, 10)).toBeNull();
    expect(horsSeuil(1000, 5, null)).toBeNull();
    expect(horsSeuil(1000, null, null)).toBeNull();
  });

  it("libellés en français", () => {
    expect(formaterValeur(12.5, "°C")).toBe("12,5 °C");
    expect(formaterValeur(3, null)).toBe("3");
    expect(libelleSeuils(5, 10, "°C")).toBe("entre 5 et 10 °C");
    expect(libelleSeuils(null, 10.5, "bar")).toBe("au plus 10,5 bar");
    expect(libelleSeuils(5, null, null)).toBe("au moins 5");
    expect(libelleSeuils(null, null, "°C")).toBeNull();
  });
});

describe("saisie", () => {
  it("nombres à la française", () => {
    expect(lireNombre("12,5")).toBe(12.5);
    expect(lireNombre("1 234,5")).toBe(1234.5);
    expect(lireNombre("-3")).toBe(-3);
    expect(lireNombre("")).toBeNull();
    expect(lireNombre("abc")).toBeNaN();
    expect(lireNombre("12,34567")).toBeNaN();
  });

  it("point : périodicité 1 à 366 jours, seuils cohérents", () => {
    const base = { libelle: "Eau chaude", periodicite_jours: "7" };
    expect(schemaPointReleve.safeParse({ ...base, seuil_min: "50", seuil_max: "60" }).success).toBe(true);
    expect(schemaPointReleve.safeParse({ ...base, seuil_min: "60", seuil_max: "50" }).success).toBe(false);
    expect(schemaPointReleve.safeParse({ ...base, periodicite_jours: "0" }).success).toBe(false);
    expect(schemaPointReleve.safeParse({ ...base, periodicite_jours: "367" }).success).toBe(false);
    expect(schemaPointReleve.safeParse({ ...base, seuil_max: "beaucoup" }).success).toBe(false);
    expect(schemaPointReleve.parse({ ...base, seuil_min: "", unite: " " })).toMatchObject({
      seuil_min: null,
      seuil_max: null,
      unite: null,
      actif: false,
    });
  });

  it("relevé : valeur obligatoire, date jamais dans le futur", () => {
    expect(schemaReleve.parse({ valeur: "12,5" }).valeur).toBe(12.5);
    expect(schemaReleve.safeParse({ valeur: "" }).success).toBe(false);
    expect(schemaReleve.safeParse({ valeur: "1", date_releve: "2099-01-01" }).success).toBe(false);
  });
});
