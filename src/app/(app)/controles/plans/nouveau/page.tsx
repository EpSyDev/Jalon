import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { optionsPlan } from "@/lib/requetes/controles";
import { creerPlan } from "../../actions";
import { ChampsPlan } from "../champs-plan";

export const metadata = { title: "Nouveau plan de contrôle — Jalon" };

export default async function PageNouveauPlan() {
  const options = await requete((tx) => optionsPlan(tx), ["admin", "technicien"]);

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouveau plan de contrôle</h1>
      {options.types.length === 0 ? (
        <>
          <p className="text-muted-foreground">Créez d&apos;abord un type de contrôle.</p>
          <LienBouton href="/controles/types">Types de contrôle</LienBouton>
        </>
      ) : (
        <Formulaire action={creerPlan} libelle="Créer le plan">
          <ChampsPlan options={options} />
        </Formulaire>
      )}
    </div>
  );
}
