import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { optionsPrestataires } from "@/lib/requetes/contrats";
import { creerContrat } from "../actions";
import { ChampsContrat } from "../champs-contrat";

export const metadata = { title: "Nouveau contrat — Jalon" };

export default async function PageNouveauContrat({ searchParams }: PageProps<"/contrats/nouveau">) {
  const { prestataire } = await searchParams;
  const prestataires = await requete((tx) => optionsPrestataires(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouveau contrat</h1>
      {prestataires.length === 0 ? (
        <>
          <p className="text-muted-foreground">Créez d&apos;abord le prestataire.</p>
          <LienBouton href="/prestataires/nouveau">Nouveau prestataire</LienBouton>
        </>
      ) : (
        <Formulaire action={creerContrat} libelle="Créer le contrat">
          <ChampsContrat
            prestataires={prestataires}
            prestataireParDefaut={prestataires.find((p) => p.id === prestataire)?.id}
          />
        </Formulaire>
      )}
    </div>
  );
}
