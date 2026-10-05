import { Formulaire } from "@/components/formulaire";
import { exigerUtilisateur } from "@/lib/auth";
import { creerPrestataire } from "../../contrats/actions";
import { ChampsPrestataire } from "../champs-prestataire";

export const metadata = { title: "Nouveau prestataire — Jalon" };

export default async function PageNouveauPrestataire() {
  await exigerUtilisateur(["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouveau prestataire</h1>
      <Formulaire action={creerPrestataire} libelle="Créer le prestataire">
        <ChampsPrestataire />
      </Formulaire>
    </div>
  );
}
