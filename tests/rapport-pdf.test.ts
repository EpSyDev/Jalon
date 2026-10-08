import { describe, expect, it } from "vitest";
import { lireRapport } from "@/lib/metier/rapport-pdf";

// Forme d'un rapport Bureau Veritas tel que le texte en est extrait (données fictives).
const PAGE_GARDE = `Bureau Veritas Exploitation SAS
A l'attention de M. DUPONT
Rapport de vérification générale périodique de
machine(s) soumise(s)
PRESSE A BALLES HSM HSM155 N° 1234.567
Intervention du 09/03/2023
Numéro d'affaire : 999
Référence du rapport : 999/2.4.1.R
Rédigé le : 09/03/2023
Par : Jean MARTIN
Ce rapport contient 2 fiches`;

const RECAPITULATIF = `Personne(s) rencontrée(s)
A notre arrivée, nous nous sommes présentés à M. DUPONT .
Équipement(s) objet(s) du présent rapport
PRESSE A BALLES : 1
Fiche n° 1 : LOCAL TRI SELECTIF
Marque: HSM Type: HSM155 n°série: 1234.567
Avis général : Satisfaisant.
Fiche n° 2 : ATELIER
Marque: ACME Type: X 200 n°série: AB-9
Avis général : Satisfaisant avec observations.
Rapport – V 1 rapport n° : 999/2.4.1.R`;

describe("lecture d'un rapport de vérification", () => {
  it("lit l'en-tête et le récapitulatif des fiches", () => {
    const r = lireRapport([PAGE_GARDE, RECAPITULATIF]);
    expect(r).toMatchObject({
      organisme: "Bureau Veritas",
      objet: "Rapport de vérification générale périodique de machine(s) soumise(s)",
      date_intervention: "2023-03-09",
      reference: "999/2.4.1.R",
      nb_fiches_annonce: 2,
    });
    expect(r.fiches).toEqual([
      {
        numero: 1,
        localisation: "LOCAL TRI SELECTIF",
        marque: "HSM",
        type: "HSM155",
        numero_serie: "1234.567",
        avis: "Satisfaisant.",
        resultat_propose: "conforme",
      },
      {
        numero: 2,
        localisation: "ATELIER",
        marque: "ACME",
        type: "X 200",
        numero_serie: "AB-9",
        avis: "Satisfaisant avec observations.",
        resultat_propose: null,
      },
    ]);
    // Un avis nuancé n'est jamais traduit d'office.
    expect(r.alertes).toEqual([
      "Fiche n° 2 : avis « Satisfaisant avec observations. » à traduire en résultat, et réserves à saisir.",
    ]);
  });

  it("signale les écarts et les manques au lieu de deviner", () => {
    const r = lireRapport([PAGE_GARDE.replace("Intervention du 09/03/2023", ""), RECAPITULATIF.split("Fiche n° 2")[0]]);
    expect(r.date_intervention).toBeNull();
    expect(r.alertes).toContain("Date d'intervention introuvable : à saisir.");
    expect(r.alertes).toContain("Le rapport annonce 2 fiche(s), 1 lue(s) : vérifiez le rapport.");
    expect(lireRapport(["Un PDF sans rien de reconnaissable"]).alertes).toContain(
      "Aucune fiche d'équipement repérée : choisissez le contrôle à la main.",
    );
  });

  it("dates impossibles refusées, noms réduits à l'initiale", () => {
    expect(lireRapport(["Intervention du 31/02/2023"]).date_intervention).toBeNull();
    const r = lireRapport(["Fiche n° 1 : BUREAU DE M. DUPONT\nAvis général : Non satisfaisant"]);
    expect(r.fiches[0]).toMatchObject({ localisation: "BUREAU DE M. D.", resultat_propose: "non_conforme" });
  });
});
