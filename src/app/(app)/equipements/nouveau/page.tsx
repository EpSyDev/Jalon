import Link from "next/link";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsEquipement } from "@/lib/requetes/parc";
import { creerEquipement } from "../actions";
import { ChampsEquipement } from "../champs-equipement";

export const metadata = { title: "Nouvel équipement — Jalon" };

export default async function PageNouvelEquipement({ searchParams }: PageProps<"/equipements/nouveau">) {
  const { univers, categorie } = await searchParams;
  const options = await requete((tx) => optionsEquipement(tx), ["admin", "technicien"]);
  // Pré-sélection depuis l'univers ou la catégorie affichés : uniquement des éléments existants.
  const categorieParDefaut = options.categories.find((c) => c.id === categorie);
  const universParDefaut =
    options.univers.find((u) => u.id === univers)?.id ?? categorieParDefaut?.univers_id ?? undefined;
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/equipements" className="text-sm text-muted-foreground underline">
        ← Parc
      </Link>
      <h1 className="text-2xl font-semibold">Nouvel équipement</h1>
      <Formulaire action={creerEquipement} libelle="Créer l'équipement">
        <ChampsEquipement
          options={options}
          universParDefaut={universParDefaut}
          categorieParDefaut={categorieParDefaut?.id}
          avecStatut
        />
      </Formulaire>
    </div>
  );
}
