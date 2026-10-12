import { requete } from "@/lib/auth";
import { genererTableur, reponseTableur } from "@/lib/export";
import { LIBELLES_STATUT } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { LIBELLES_STATUT_EQUIPEMENT } from "@/lib/metier/parc";
import { listerEquipements } from "@/lib/requetes/parc";
import { lireFiltresParc } from "../filtres";

/** Parc filtré comme à l'écran, en entier (sans pagination). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filtres = lireFiltresParc((cle) => params.get(cle) ?? undefined);
  const { equipements } = await requete((tx) => listerEquipements(tx, filtres, null));
  const contenu = await genererTableur(
    "Parc",
    [
      { entete: "Code", largeur: 16 },
      { entete: "Libellé", largeur: 36 },
      { entete: "Univers", largeur: 22 },
      { entete: "Catégorie", largeur: 22 },
      { entete: "Localisation", largeur: 30 },
      { entete: "Statut", largeur: 22 },
      { entete: "Statut depuis", type: "date", largeur: 12 },
      { entete: "Retour prévu", type: "date", largeur: 12 },
      { entete: "Contrôles suivis", type: "nombre", largeur: 10 },
      { entete: "Contrôle le plus urgent", largeur: 20 },
    ],
    equipements.map((e) => [
      e.code,
      e.libelle,
      e.univers,
      e.categorie,
      e.localisation,
      LIBELLES_STATUT_EQUIPEMENT[e.statut],
      e.statut_depuis,
      e.statut_retour_prevu,
      e.statuts_plans.length,
      e.synthese ? LIBELLES_STATUT[e.synthese] : null,
    ]),
  );
  return reponseTableur(contenu, `jalon-parc-${aujourdhuiParis()}.xlsx`);
}
