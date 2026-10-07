import { requete } from "@/lib/auth";
import { genererTableur, reponseTableur } from "@/lib/export";
import { LIBELLES_STATUT } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { listerEquipements } from "@/lib/requetes/parc";
import { LIBELLES_STATUT_EQUIPEMENT } from "../champs-equipement";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Parc filtré comme à l'écran, en entier (sans pagination). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const texte = (cle: string) => {
    const v = params.get(cle);
    return v && v.length <= 100 ? v : undefined;
  };
  const uuid = (cle: string) => {
    const v = texte(cle);
    return v && UUID.test(v) ? v : undefined;
  };
  const statut = texte("statut");
  const { equipements } = await requete((tx) =>
    listerEquipements(
      tx,
      {
        q: texte("q"),
        statut: statut && statut in LIBELLES_STATUT_EQUIPEMENT ? statut : undefined,
        famille: uuid("famille"),
        univers: texte("univers") === "aucun" ? "aucun" : uuid("univers"),
        localisation: uuid("localisation"),
      },
      null,
    ),
  );
  const contenu = await genererTableur(
    "Parc",
    [
      { entete: "Code", largeur: 16 },
      { entete: "Libellé", largeur: 36 },
      { entete: "Univers", largeur: 22 },
      { entete: "Famille", largeur: 20 },
      { entete: "Localisation", largeur: 30 },
      { entete: "Statut", largeur: 14 },
      { entete: "Contrôles suivis", type: "nombre", largeur: 10 },
      { entete: "Contrôle le plus urgent", largeur: 20 },
    ],
    equipements.map((e) => [
      e.code,
      e.libelle,
      e.univers,
      e.famille,
      e.localisation,
      LIBELLES_STATUT_EQUIPEMENT[e.statut],
      e.statuts_plans.length,
      e.synthese ? LIBELLES_STATUT[e.synthese] : null,
    ]),
  );
  return reponseTableur(contenu, `jalon-parc-${aujourdhuiParis()}.xlsx`);
}
