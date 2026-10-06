import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { z } from "zod";
import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { formaterQuantite } from "@/lib/metier/stocks";
import { lireArticle, mouvementsArticle } from "@/lib/requetes/stocks";
import { cn } from "@/lib/utils";
import { archiverMouvement, enregistrerMouvement } from "../actions";

export const metadata = { title: "Article — Jalon" };

export default async function PageArticle({ params }: PageProps<"/stocks/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const article = await lireArticle(tx, id);
    return article ? { article, mouvements: await mouvementsArticle(tx, id), role: u.role } : null;
  });
  if (!donnees) notFound();
  const { article: a, mouvements, role } = donnees;
  const aujourdhui = aujourdhuiParis();

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/stocks" className="text-sm text-muted-foreground underline">
          ← Stocks
        </Link>
        <h1 className="text-2xl font-semibold">{a.libelle}</h1>
        {a.reference && <p className="text-muted-foreground">Réf. {a.reference}</p>}
      </div>

      <div className="grid gap-1 rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Stock disponible</span>
        <span className="text-4xl font-semibold tabular-nums">{formaterQuantite(a.stock, a.unite)}</span>
        {a.seuil_alerte && (
          <span
            className={cn(
              "flex items-center gap-1 text-sm",
              a.sous_seuil ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {a.sous_seuil && <TriangleAlert className="size-4" aria-hidden />}
            Seuil d&apos;alerte : {formaterQuantite(a.seuil_alerte, a.unite)}
          </span>
        )}
      </div>

      {role !== "lecture" && (
        <section className="grid gap-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Entrée ou sortie</h2>
          <Formulaire action={enregistrerMouvement.bind(null, a.id)} libelle="Enregistrer le mouvement" reinitialiser>
            <div className="grid gap-4 sm:grid-cols-3">
              <ChampListe
                nom="sens"
                libelle="Sens"
                defaultValue="sortie"
                options={[
                  { valeur: "sortie", libelle: "Sortie" },
                  { valeur: "entree", libelle: "Entrée" },
                ]}
              />
              <ChampTexte
                nom="quantite"
                libelle={`Quantité${a.unite ? ` (${a.unite})` : ""}`}
                inputMode="decimal"
                required
              />
              <ChampTexte
                nom="date_mouvement"
                libelle="Date"
                type="date"
                defaultValue={aujourdhui}
                max={aujourdhui}
                required
              />
            </div>
            <ChampZoneTexte
              nom="commentaire"
              libelle="Commentaire"
              placeholder="Ex. : pour intervention BAES couloir est"
            />
          </Formulaire>
          <LienBouton href={`/stocks/${a.id}/modifier`} variante="outline" className="h-12 text-base">
            Modifier l&apos;article
          </LienBouton>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Mouvements</h2>
        {mouvements.length === 0 && <p className="text-sm text-muted-foreground">Aucun mouvement.</p>}
        <ol className="grid gap-2">
          {mouvements.map((m) => (
            <li key={m.id} className="grid gap-1 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{formaterDate(m.date_mouvement)}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    m.sens === "entree" ? "text-emerald-700 dark:text-emerald-400" : "",
                  )}
                >
                  {m.sens === "entree" ? "+" : "−"}
                  {formaterQuantite(m.quantite, a.unite)}
                </span>
              </div>
              {m.commentaire && <div className="whitespace-pre-line">{m.commentaire}</div>}
              {m.auteur && <div className="text-xs text-muted-foreground">{m.auteur}</div>}
              {role === "admin" && (
                <Formulaire
                  action={archiverMouvement.bind(null, a.id, m.id)}
                  libelle="Retirer (saisie erronée)"
                  variante="outline"
                  confirmation="Retirer ce mouvement ? Le stock sera recalculé ; l'opération reste tracée."
                />
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
