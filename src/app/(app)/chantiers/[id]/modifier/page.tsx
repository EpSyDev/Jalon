import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireChantier, responsablesPossibles } from "@/lib/requetes/interventions";
import { archiverChantier, modifierChantier } from "../../../interventions/actions";
import { ChampsChantier } from "../../champs-chantier";

export const metadata = { title: "Modifier le chantier — Jalon" };

export default async function PageModifierChantier({ params }: PageProps<"/chantiers/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const chantier = await lireChantier(tx, id);
      return chantier ? { chantier, responsables: await responsablesPossibles(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { chantier, responsables, role } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/chantiers/${id}`} className="text-sm text-muted-foreground underline">
        ← {chantier.titre}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le chantier</h1>
      <Formulaire action={modifierChantier.bind(null, id)} libelle="Enregistrer">
        <ChampsChantier responsables={responsables} chantier={chantier} />
      </Formulaire>
      {role === "admin" && (
        <Formulaire
          action={archiverChantier.bind(null, id)}
          libelle="Archiver ce chantier"
          variante="destructive"
          confirmation="Archiver ce chantier ?"
        />
      )}
    </div>
  );
}
