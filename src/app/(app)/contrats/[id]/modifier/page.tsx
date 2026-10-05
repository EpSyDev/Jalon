import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireContrat, optionsPrestataires } from "@/lib/requetes/contrats";
import { archiverContrat, modifierContrat } from "../../actions";
import { ChampsContrat } from "../../champs-contrat";

export const metadata = { title: "Modifier le contrat — Jalon" };

export default async function PageModifierContrat({ params }: PageProps<"/contrats/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const contrat = await lireContrat(tx, id);
      return contrat ? { contrat, prestataires: await optionsPrestataires(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/contrats/${id}`} className="text-sm text-muted-foreground underline">
        ← {donnees.contrat.objet}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le contrat</h1>
      <p className="rounded-md bg-muted p-3 text-sm">
        Contrat reconduit ? Reportez simplement la nouvelle date de fin : l&apos;alerte de préavis repartira pour le
        nouveau cycle.
      </p>
      <Formulaire action={modifierContrat.bind(null, id)} libelle="Enregistrer">
        <ChampsContrat prestataires={donnees.prestataires} contrat={donnees.contrat} />
      </Formulaire>
      {donnees.role === "admin" && (
        <Formulaire
          action={archiverContrat.bind(null, id)}
          libelle="Archiver ce contrat"
          variante="destructive"
          confirmation="Archiver ce contrat ? Les plans de contrôle rattachés seront détachés."
        />
      )}
    </div>
  );
}
