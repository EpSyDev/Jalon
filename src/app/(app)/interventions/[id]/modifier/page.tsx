import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireIntervention, optionsIntervention } from "@/lib/requetes/interventions";
import { archiverIntervention, modifierIntervention } from "../../actions";
import { ChampsIntervention } from "../../champs-intervention";

export const metadata = { title: "Modifier l'intervention — Jalon" };

export default async function PageModifierIntervention({ params }: PageProps<"/interventions/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const intervention = await lireIntervention(tx, id);
      return intervention ? { intervention, options: await optionsIntervention(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { intervention, options, role } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/interventions/${id}`} className="text-sm text-muted-foreground underline">
        ← {intervention.titre}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier l&apos;intervention</h1>
      <Formulaire action={modifierIntervention.bind(null, id)} libelle="Enregistrer">
        <ChampsIntervention options={options} intervention={intervention} />
      </Formulaire>
      {role === "admin" && (
        <Formulaire
          action={archiverIntervention.bind(null, id)}
          libelle="Archiver (saisie erronée)"
          variante="destructive"
          confirmation="Archiver cette intervention ? Elle disparaîtra des listes ; l'opération reste tracée."
        />
      )}
    </div>
  );
}
