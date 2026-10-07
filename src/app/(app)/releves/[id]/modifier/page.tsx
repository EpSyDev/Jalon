import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lirePoint, optionsPoint } from "@/lib/requetes/releves";
import { archiverPoint, modifierPoint } from "../../actions";
import { ChampsPoint } from "../../champs-point";

export const metadata = { title: "Modifier le point de relevé — Jalon" };

export default async function PageModifierPoint({ params }: PageProps<"/releves/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const point = await lirePoint(tx, id);
      return point ? { point, options: await optionsPoint(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/releves/${id}`} className="text-sm text-muted-foreground underline">
        ← {donnees.point.libelle}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le point de relevé</h1>
      <Formulaire action={modifierPoint.bind(null, id)} libelle="Enregistrer">
        <ChampsPoint options={donnees.options} point={donnees.point} />
      </Formulaire>
      {donnees.role === "admin" && (
        <Formulaire
          action={archiverPoint.bind(null, id)}
          libelle="Archiver ce point"
          variante="destructive"
          confirmation="Archiver ce point de relevé ? L'historique est conservé."
        />
      )}
    </div>
  );
}
