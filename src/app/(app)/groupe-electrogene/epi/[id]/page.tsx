import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireEpi, optionsGroupe } from "@/lib/requetes/groupe-electrogene";
import { archiverEpi, modifierEpi, supprimerEpi } from "../../actions";
import { ChampsEpi } from "../champs-epi";

export const metadata = { title: "EPI — Jalon" };

export default async function PageEpi({ params }: PageProps<"/groupe-electrogene/epi/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const epi = await lireEpi(tx, id);
      return epi ? { epi, ...(await optionsGroupe(tx)), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { epi, localisations, role } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/groupe-electrogene" className="text-sm text-muted-foreground underline">
        ← Groupe électrogène
      </Link>
      <h1 className="text-2xl font-semibold">{epi.libelle}</h1>
      <Formulaire action={modifierEpi.bind(null, id)} libelle="Enregistrer">
        <ChampsEpi epi={epi} localisations={localisations} />
      </Formulaire>
      {role === "admin" && (
        <div className="grid gap-3 border-t pt-4">
          <Formulaire
            action={archiverEpi.bind(null, id)}
            libelle="Archiver cet EPI"
            variante="outline"
            confirmation="Archiver cet EPI ? Il ne sera plus suivi ni rappelé."
          />
          <BoutonSupprimer action={supprimerEpi.bind(null, id)} nom="cet EPI" />
        </div>
      )}
    </div>
  );
}
