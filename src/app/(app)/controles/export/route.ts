import { requete } from "@/lib/auth";
import { genererTableur, reponseTableur } from "@/lib/export";
import { LIBELLES_CARACTERE, LIBELLES_STATUT } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { listerPlans } from "@/lib/requetes/controles";

/** Tous les plans actifs avec leur échéance : sert aussi de plan de repli papier/Excel. */
export async function GET() {
  const plans = await requete((tx) => listerPlans(tx));
  const contenu = await genererTableur(
    "Échéances",
    [
      { entete: "Statut", largeur: 16 },
      { entete: "Prochaine échéance", type: "date", largeur: 14 },
      { entete: "Contrôle", largeur: 34 },
      { entete: "Famille", largeur: 18 },
      { entete: "Caractère", largeur: 14 },
      { entete: "Équipement", largeur: 14 },
      { entete: "Périmètre", largeur: 30 },
      { entete: "Prestataire", largeur: 22 },
      { entete: "Périodicité (mois)", type: "nombre", largeur: 10 },
      { entete: "Dernier contrôle", type: "date", largeur: 14 },
      { entete: "Réserves ouvertes", type: "nombre", largeur: 10 },
    ],
    plans.map((p) => [
      LIBELLES_STATUT[p.statut_echeance],
      p.prochaine_echeance,
      p.type_libelle,
      p.famille_libelle,
      LIBELLES_CARACTERE[p.caractere],
      p.equipement_code,
      p.perimetre,
      p.prestataire_nom,
      p.periodicite_mois,
      p.dernier_controle,
      p.nb_reserves_ouvertes,
    ]),
  );
  return reponseTableur(contenu, `jalon-echeances-${aujourdhuiParis()}.xlsx`);
}
