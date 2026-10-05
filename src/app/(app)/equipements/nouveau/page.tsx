import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsEquipement } from "@/lib/requetes/parc";
import { creerEquipement } from "../actions";
import { ChampsEquipement } from "../champs-equipement";

export const metadata = { title: "Nouvel équipement — Jalon" };

export default async function PageNouvelEquipement() {
  const options = await requete((tx) => optionsEquipement(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouvel équipement</h1>
      <Formulaire action={creerEquipement} libelle="Créer l'équipement">
        <ChampsEquipement options={options} />
      </Formulaire>
    </div>
  );
}
