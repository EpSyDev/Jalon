import Link from "next/link";
import { ChevronRight, ClipboardPlus, Download, Plus, Route } from "lucide-react";
import { BadgeReserves, BadgeStatut } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { buttonVariants } from "@/components/ui/button";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_STATUT, ORDRE_STATUT } from "@/lib/format";
import { grouperControles } from "@/lib/metier/controles";
import type { StatutEcheance } from "@/lib/metier/echeance";
import { listerPlans } from "@/lib/requetes/controles";
import { cn } from "@/lib/utils";

export const metadata = { title: "Contrôles — Jalon" };

const PLURIEL_CARACTERE = {
  reglementaire: "Réglementaires",
  obligatoire: "Obligatoires",
  interne: "Internes",
} as const;

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
  const familles = grouperControles(visibles);

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contrôles</h1>
        {peutEcrire && (
          <LienBouton href="/controles/nouveau">
            <Plus className="size-4" aria-hidden />
            Nouveau contrôle
          </LienBouton>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {peutEcrire && (
          <LienBouton href="/controles/saisie" variante="outline">
            <ClipboardPlus className="size-4" aria-hidden />
            Saisir un contrôle réalisé
          </LienBouton>
        )}
        <LienBouton href="/controles/tournee" variante="outline">
          <Route className="size-4" aria-hidden />
          Tournée
        </LienBouton>
        <a href="/controles/export" className={buttonVariants({ variant: "outline" })}>
          <Download className="size-4" aria-hidden />
          Exporter (Excel)
        </a>
        <LienBouton href="/controles/types" variante="ghost">
          Gérer les types
        </LienBouton>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par statut">
        <Link
          href="/controles"
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-1.5 text-sm",
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
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-1.5 text-sm",
              statutActif === s && "bg-foreground text-background",
            )}
          >
            {LIBELLES_STATUT[s]} ({compte(s)})
          </Link>
        ))}
      </nav>

      {familles.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {plans.length === 0
            ? "Aucun contrôle pour l'instant. Cliquez sur « Nouveau contrôle »."
            : "Aucun contrôle dans ce statut."}
        </p>
      ) : (
        familles.map((f) => (
          <section key={f.famille_id} className="grid gap-3" aria-labelledby={`famille-${f.famille_id}`}>
            <div className="flex items-center justify-between gap-2 border-b pb-1">
              <h2 id={`famille-${f.famille_id}`} className="text-xl font-semibold">
                {f.famille}
              </h2>
              {peutEcrire && (
                <Link href={`/controles/nouveau?famille=${f.famille_id}`} className="text-sm underline">
                  + Ajouter un contrôle
                </Link>
              )}
            </div>
            {f.groupes.map((g) => (
              <div key={g.caractere} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="surtitre">
                    {PLURIEL_CARACTERE[g.caractere]} · {g.plans.length}
                  </h3>
                  {peutEcrire && (
                    <Link
                      href={`/controles/nouveau?famille=${f.famille_id}&caractere=${g.caractere}`}
                      className="inline-flex min-h-11 items-center text-sm underline"
                    >
                      + Ajouter
                    </Link>
                  )}
                </div>
                <ul className="grid gap-2">
                  {g.plans.map((p) => (
                    <li key={p.plan_controle_id}>
                      <Link
                        href={`/controles/plans/${p.plan_controle_id}`}
                        className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50"
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
                              <span className="text-muted-foreground">
                                Échéance {formaterDate(p.prochaine_echeance)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
