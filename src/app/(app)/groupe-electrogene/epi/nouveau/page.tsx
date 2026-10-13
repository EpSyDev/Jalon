import Link from "next/link";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsGroupe } from "@/lib/requetes/groupe-electrogene";
import { creerEpi } from "../../actions";
import { ChampsEpi } from "../champs-epi";

export const metadata = { title: "Nouvel EPI — Jalon" };

export default async function PageNouvelEpi() {
  const { localisations } = await requete((tx) => optionsGroupe(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/groupe-electrogene" className="text-sm text-muted-foreground underline">
        ← Groupe électrogène
      </Link>
      <h1 className="text-2xl font-semibold">Nouvel EPI</h1>
      <Formulaire action={creerEpi} libelle="Ajouter l'EPI">
        <ChampsEpi localisations={localisations} />
      </Formulaire>
    </div>
  );
}
