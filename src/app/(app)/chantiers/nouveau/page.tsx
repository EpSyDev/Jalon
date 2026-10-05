import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { responsablesPossibles } from "@/lib/requetes/interventions";
import { creerChantier } from "../../interventions/actions";
import { ChampsChantier } from "../champs-chantier";

export const metadata = { title: "Nouveau chantier — Jalon" };

export default async function PageNouveauChantier() {
  const responsables = await requete((tx) => responsablesPossibles(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouveau chantier</h1>
      <Formulaire action={creerChantier} libelle="Créer le chantier">
        <ChampsChantier responsables={responsables} />
      </Formulaire>
    </div>
  );
}
