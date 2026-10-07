import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { LIBELLES_STATUT_CHANTIER } from "@/lib/metier/interventions";
import { listerChantiers } from "@/lib/requetes/interventions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Chantiers — Jalon" };

export default async function PageChantiers({ searchParams }: PageProps<"/chantiers">) {
  const tous = (await searchParams).tous === "1";
  const { chantiers, peutEcrire } = await requete(async (tx, u) => ({
    chantiers: await listerChantiers(tx, !tous),
    peutEcrire: u.role !== "lecture",
  }));
  const aujourdhui = aujourdhuiParis();

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Chantiers</h1>
        {peutEcrire && (
          <LienBouton href="/chantiers/nouveau">
            <Plus className="size-4" aria-hidden />
            Nouveau chantier
          </LienBouton>
        )}
      </div>
      <nav className="flex gap-2" aria-label="Vues">
        {[
          { href: "/chantiers", libelle: "Actifs", actif: !tous },
          { href: "/chantiers?tous=1", libelle: "Tous", actif: tous },
        ].map((v) => (
          <Link
            key={v.href}
            href={v.href}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-sm",
              v.actif && "bg-foreground text-background",
            )}
          >
            {v.libelle}
          </Link>
        ))}
      </nav>

      {chantiers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucun chantier.</p>
      ) : (
        <ul className="grid gap-2">
          {chantiers.map((c) => {
            const enRetard =
              c.date_fin_prevue !== null && c.date_fin_prevue < aujourdhui && ["prevu", "en_cours"].includes(c.statut);
            return (
              <li key={c.id}>
                <Link
                  href={`/chantiers/${c.id}`}
                  className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
                >
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="font-medium">{c.titre}</div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary">{LIBELLES_STATUT_CHANTIER[c.statut]}</Badge>
                      {c.responsable_nom && <span className="text-muted-foreground">{c.responsable_nom}</span>}
                      {c.date_fin_prevue && (
                        <span className={enRetard ? "font-medium text-destructive" : "text-muted-foreground"}>
                          fin prévue le {formaterDate(c.date_fin_prevue)}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {`${c.nb_ouvertes}/${c.nb_total} intervention${c.nb_total > 1 ? "s" : ""} ouverte${c.nb_ouvertes > 1 ? "s" : ""}`}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
