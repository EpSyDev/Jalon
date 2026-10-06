import { Formulaire } from "@/components/formulaire";
import { exigerUtilisateur } from "@/lib/auth";
import { creerArticle } from "../actions";
import { ChampsArticle } from "../champs-article";

export const metadata = { title: "Nouvel article — Jalon" };

export default async function PageNouvelArticle() {
  await exigerUtilisateur(["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouvel article</h1>
      <Formulaire action={creerArticle} libelle="Créer l'article">
        <ChampsArticle />
      </Formulaire>
    </div>
  );
}
