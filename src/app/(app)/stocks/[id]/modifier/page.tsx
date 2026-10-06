import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireArticle } from "@/lib/requetes/stocks";
import { archiverArticle, modifierArticle } from "../../actions";
import { ChampsArticle } from "../../champs-article";

export const metadata = { title: "Modifier l'article — Jalon" };

export default async function PageModifierArticle({ params }: PageProps<"/stocks/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const article = await lireArticle(tx, id);
      return article ? { article, role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/stocks/${id}`} className="text-sm text-muted-foreground underline">
        ← {donnees.article.libelle}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier l&apos;article</h1>
      <Formulaire action={modifierArticle.bind(null, id)} libelle="Enregistrer">
        <ChampsArticle article={donnees.article} />
      </Formulaire>
      {donnees.role === "admin" && (
        <Formulaire
          action={archiverArticle.bind(null, id)}
          libelle="Archiver cet article"
          variante="destructive"
          confirmation="Archiver cet article ? Ses mouvements restent dans l'historique."
        />
      )}
    </div>
  );
}
