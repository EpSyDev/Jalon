import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsPrestataires } from "@/lib/requetes/contacts";
import { creerContact } from "../actions";
import { ChampsContact } from "../champs-contact";

export const metadata = { title: "Nouveau contact — Jalon" };

export default async function PageNouveauContact() {
  const prestataires = await requete((tx) => optionsPrestataires(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouveau contact</h1>
      <Formulaire action={creerContact} libelle="Créer le contact">
        <ChampsContact prestataires={prestataires} />
      </Formulaire>
    </div>
  );
}
