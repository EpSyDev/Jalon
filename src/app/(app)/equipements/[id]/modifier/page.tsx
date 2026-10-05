import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireEquipement, optionsEquipement } from "@/lib/requetes/parc";
import { archiverEquipement, modifierEquipement } from "../../actions";
import { ChampsEquipement } from "../../champs-equipement";

export const metadata = { title: "Modifier l'équipement — Jalon" };

export default async function PageModifierEquipement({ params }: PageProps<"/equipements/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const equipement = await lireEquipement(tx, id);
      return equipement ? { equipement, options: await optionsEquipement(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { equipement, options, role } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/equipements/${id}`} className="text-sm text-muted-foreground underline">
        ← {equipement.code}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier l&apos;équipement</h1>
      <Formulaire action={modifierEquipement.bind(null, id)} libelle="Enregistrer">
        <ChampsEquipement options={options} equipement={equipement} />
      </Formulaire>
      {role === "admin" && (
        <Formulaire
          action={archiverEquipement.bind(null, id)}
          libelle="Archiver cet équipement"
          variante="destructive"
          confirmation="Archiver cet équipement ? Son QR code ne fonctionnera plus. L'historique est conservé."
        />
      )}
    </div>
  );
}
