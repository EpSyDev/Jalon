import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { comparerInterventions, LIBELLES_STATUT_INTERVENTION } from "@/lib/metier/interventions";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { listerInterventions } from "@/lib/requetes/interventions";
import { cn } from "@/lib/utils";
import { BadgePriorite } from "./champs-intervention";

export const metadata = { title: "Interventions — Jalon" };

const VUES = [
  { cle: "ouvertes", libelle: "En cours" },
  { cle: "miennes", libelle: "Les miennes" },
  { cle: "cloturees", libelle: "Clôturées" },
] as const;

export default async function PageInterventions({ searchParams }: PageProps<"/interventions">) {
  const { vue: brut } = await searchParams;
  const vue = VUES.find((v) => v.cle === brut)?.cle ?? "ouvertes";
  const { interventions, peutEcrire } = await requete(async (tx, u) => ({
    interventions: await listerInterventions(tx, vue, u.id),
    peutEcrire: u.role !== "lecture",
  }));
  const triees = vue === "cloturees" ? interventions : [...interventions].sort(comparerInterventions);
  const aujourdhui = aujourdhuiParis();

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Interventions</h1>
        <div className="flex flex-wrap gap-2">
          <LienBouton href="/chantiers" variante="outline">
            Chantiers
          </LienBouton>
          {peutEcrire && (
            <LienBouton href="/interventions/nouvelle">
              <Plus className="size-4" aria-hidden />
              Nouvelle intervention
            </LienBouton>
          )}
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Vues">
        {VUES.map((v) => (
          <Link
            key={v.cle}
            href={v.cle === "ouvertes" ? "/interventions" : `/interventions?vue=${v.cle}`}
            className={cn(
              "shrink-0 inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-sm",
              vue === v.cle && "bg-foreground text-background",
            )}
          >
            {v.libelle}
          </Link>
        ))}
      </nav>

      {triees.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucune intervention.</p>
      ) : (
        <ul className="grid gap-2">
          {triees.map((i) => {
            const enRetard = i.date_prevue !== null && i.date_prevue < aujourdhui && !i.date_cloture;
            return (
              <li key={i.id}>
                <Link
                  href={`/interventions/${i.id}`}
                  className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
                >
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="font-medium">{i.titre}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {[i.equipement_code, i.chantier_titre, i.assignee_nom ?? i.prestataire_nom]
                        .filter(Boolean)
                        .join(" · ") || "Non assignée"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <BadgePriorite priorite={i.priorite} />
                      <span>{LIBELLES_STATUT_INTERVENTION[i.statut]}</span>
                      {i.date_cloture ? (
                        <span className="text-muted-foreground">le {formaterDate(i.date_cloture)}</span>
                      ) : (
                        i.date_prevue && (
                          <span className={enRetard ? "font-medium text-destructive" : "text-muted-foreground"}>
                            prévue le {formaterDate(i.date_prevue)}
                          </span>
                        )
                      )}
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
