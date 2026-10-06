import Link from "next/link";
import { ChevronRight, ClipboardPlus } from "lucide-react";
import { BadgeReserves, BadgeStatut } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_STATUT, ORDRE_STATUT } from "@/lib/format";
import type { StatutEcheance } from "@/lib/metier/echeance";
import { listerPlans } from "@/lib/requetes/controles";
import { cn } from "@/lib/utils";

export const metadata = { title: "Contrôles — Jalon" };

export default async function PageControles({ searchParams }: PageProps<"/controles">) {
  const { statut: filtre } = await searchParams;
  const { plans, peutEcrire } = await requete(async (tx, u) => ({
    plans: await listerPlans(tx),
    peutEcrire: u.role !== "lecture",
  }));

  const compte = (s: StatutEcheance) => plans.filter((p) => p.statut_echeance === s).length;
  const statutActif = ORDRE_STATUT.find((s) => s === filtre);
  const visibles = plans
    .filter((p) => !statutActif || p.statut_echeance === statutActif)
    .sort((a, b) => ORDRE_STATUT.indexOf(a.statut_echeance) - ORDRE_STATUT.indexOf(b.statut_echeance));

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contrôles</h1>
        <div className="flex flex-wrap gap-2">
          <LienBouton href="/controles/types" variante="outline">
            Types de contrôle
          </LienBouton>
          {peutEcrire && (
            <LienBouton href="/controles/plans/nouveau" variante="outline">
              Nouveau plan
            </LienBouton>
          )}
        </div>
      </div>

      {peutEcrire && (
        <LienBouton href="/controles/saisie" className="h-14 text-base">
          <ClipboardPlus className="size-5" aria-hidden />
          Saisir un contrôle réalisé
        </LienBouton>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par statut">
        <Link
          href="/controles"
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm",
            !statutActif && "bg-foreground text-background",
          )}
        >
          Tous ({plans.length})
        </Link>
        {ORDRE_STATUT.map((s) => (
          <Link
            key={s}
            href={`/controles?statut=${s}`}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              statutActif === s && "bg-foreground text-background",
            )}
          >
            {LIBELLES_STATUT[s]} ({compte(s)})
          </Link>
        ))}
      </nav>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {plans.length === 0
            ? "Aucun plan de contrôle. Commencez par créer un type, puis un plan."
            : "Aucun plan dans ce statut."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {visibles.map((p) => (
            <li key={p.plan_controle_id}>
              <Link
                href={`/controles/plans/${p.plan_controle_id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="font-medium">{p.type_libelle}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {[p.equipement_code, p.perimetre].filter(Boolean).join(" — ")}
                    {p.prestataire_nom && ` · ${p.prestataire_nom}`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <BadgeStatut statut={p.statut_echeance} />
                    <BadgeReserves ouvertes={p.nb_reserves_ouvertes} />
                    {p.prochaine_echeance && (
                      <span className="text-muted-foreground">Échéance {formaterDate(p.prochaine_echeance)}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
