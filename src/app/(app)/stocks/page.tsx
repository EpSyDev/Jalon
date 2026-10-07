import Link from "next/link";
import { ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { formaterQuantite } from "@/lib/metier/stocks";
import { listerArticles } from "@/lib/requetes/stocks";
import { cn } from "@/lib/utils";

export const metadata = { title: "Stocks — Jalon" };

export default async function PageStocks({ searchParams }: PageProps<"/stocks">) {
  const sousSeuil = (await searchParams).filtre === "seuil";
  const { articles, peutEcrire } = await requete(async (tx, u) => ({
    articles: await listerArticles(tx, sousSeuil),
    peutEcrire: u.role !== "lecture",
  }));

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Stocks</h1>
        {peutEcrire && (
          <LienBouton href="/stocks/nouveau">
            <Plus className="size-4" aria-hidden />
            Nouvel article
          </LienBouton>
        )}
      </div>
      <nav className="flex gap-2" aria-label="Filtres">
        {[
          { href: "/stocks", libelle: "Tous", actif: !sousSeuil },
          { href: "/stocks?filtre=seuil", libelle: "Sous le seuil", actif: sousSeuil },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-sm",
              f.actif && "bg-foreground text-background",
            )}
          >
            {f.libelle}
          </Link>
        ))}
      </nav>
      {articles.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {sousSeuil
            ? "Aucun article sous son seuil d'alerte."
            : "Aucun article. Créez le premier pour suivre un stock."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/stocks/${a.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="font-medium">
                    {a.libelle}
                    {a.reference && <span className="text-muted-foreground"> · {a.reference}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {a.sous_seuil && (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="size-4" aria-hidden />
                        Sous le seuil
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {a.dernier_mouvement
                        ? `Dernier mouvement le ${formaterDate(a.dernier_mouvement)}`
                        : "Aucun mouvement"}
                    </span>
                  </div>
                </div>
                <span className="text-right text-xl font-semibold tabular-nums">
                  {formaterQuantite(a.stock, a.unite)}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
