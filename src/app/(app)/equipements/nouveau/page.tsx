import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsEquipement } from "@/lib/requetes/parc";
import { creerEquipement } from "../actions";
import { ChampsEquipement } from "../champs-equipement";

export const metadata = { title: "Nouvel équipement — Jalon" };

export default async function PageNouvelEquipement({ searchParams }: PageProps<"/equipements/nouveau">) {
  const { univers } = await searchParams;
  const options = await requete((tx) => optionsEquipement(tx), ["admin", "technicien"]);
  // Pré-sélection depuis la page « Univers » : uniquement un univers existant.
  const universParDefaut = options.univers.find((u) => u.id === univers)?.id;
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouvel équipement</h1>
      <Formulaire action={creerEquipement} libelle="Créer l'équipement">
        <ChampsEquipement options={options} universParDefaut={universParDefaut} />
      </Formulaire>
    </div>
  );
}
