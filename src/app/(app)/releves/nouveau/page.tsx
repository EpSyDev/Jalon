import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsPoint } from "@/lib/requetes/releves";
import { creerPoint } from "../actions";
import { ChampsPoint } from "../champs-point";

export const metadata = { title: "Nouveau point de relevé — Jalon" };

export default async function PageNouveauPoint() {
  const options = await requete((tx) => optionsPoint(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouveau point de relevé</h1>
      <Formulaire action={creerPoint} libelle="Créer le point">
        <ChampsPoint options={options} />
      </Formulaire>
    </div>
  );
}
