import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lirePrestataire } from "@/lib/requetes/contrats";
import { archiverPrestataire, supprimerPrestataire, modifierPrestataire } from "../../../contrats/actions";
import { ChampsPrestataire } from "../../champs-prestataire";

export const metadata = { title: "Modifier le prestataire — Jalon" };

export default async function PageModifierPrestataire({ params }: PageProps<"/prestataires/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const prestataire = await lirePrestataire(tx, id);
      return prestataire ? { prestataire, role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/prestataires/${id}`} className="text-sm text-muted-foreground underline">
        ← {donnees.prestataire.nom}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le prestataire</h1>
      <Formulaire action={modifierPrestataire.bind(null, id)} libelle="Enregistrer">
        <ChampsPrestataire prestataire={donnees.prestataire} />
      </Formulaire>
      {donnees.role === "admin" && (
        <div className="grid gap-3 border-t pt-4">
          <Formulaire
            action={archiverPrestataire.bind(null, id)}
            libelle="Archiver ce prestataire"
            variante="outline"
            confirmation="Archiver ce prestataire ?"
          />
          <BoutonSupprimer action={supprimerPrestataire.bind(null, id)} nom="ce prestataire" />
        </div>
      )}
    </div>
  );
}
