import Link from "next/link";
import { CircleCheck, MapPin } from "lucide-react";
import { BadgeStatut } from "@/components/badges";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { grouperParLocal } from "@/lib/metier/tournee";
import { plansTournee } from "@/lib/requetes/controles";
import { cn } from "@/lib/utils";
import { BoutonConforme } from "./bouton-conforme";

export const metadata = { title: "Tournée — Jalon" };

const FILTRES = {
  tous: "Tous",
  interne: "Internes",
  reglementaire: "Réglementaires",
  obligatoire: "Obligatoires",
} as const;

/** Mode tournée : passer de local en local, valider d'une main les contrôles faits sur place. */
export default async function PageTournee({ searchParams }: PageProps<"/controles/tournee">) {
  const { caractere } = await searchParams;
  const filtre = typeof caractere === "string" && caractere in FILTRES ? (caractere as keyof typeof FILTRES) : "tous";
  const { plans, peutEcrire } = await requete(async (tx, u) => ({
    plans: await plansTournee(tx),
    peutEcrire: u.role !== "lecture",
  }));
  const arrets = grouperParLocal(plans.filter((p) => filtre === "tous" || p.caractere === filtre));
  const retour = `/controles/tournee${filtre === "tous" ? "" : `?caractere=${filtre}`}`;

  return (
    <div className="mx-auto grid max-w-2xl gap-4 p-4 md:p-8">
      <div className="grid gap-1">
        <Link href="/controles" className="text-sm text-muted-foreground underline">
          ← Contrôles
        </Link>
        <h1 className="text-2xl font-semibold">Tournée</h1>
        <p className="text-sm text-muted-foreground">
          Les contrôles à faire, local par local. « Conforme » enregistre un contrôle conforme réalisé aujourd&apos;hui
          (deux touches) ; pour des réserves, « Autre résultat ».
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par caractère">
        {Object.entries(FILTRES).map(([cle, libelle]) => (
          <Link
            key={cle}
            href={cle === "tous" ? "/controles/tournee" : `/controles/tournee?caractere=${cle}`}
            className={cn("rounded-full border px-3 py-1.5 text-sm", filtre === cle && "bg-foreground text-background")}
          >
            {libelle}
          </Link>
        ))}
      </nav>

      {arrets.length === 0 && (
        <p className="flex items-center gap-3 rounded-lg border bg-card p-6 text-lg">
          <CircleCheck className="size-6 text-emerald-600" aria-hidden />
          Rien à contrôler pour l&apos;instant.
        </p>
      )}

      {arrets.map((a) => (
        <details key={a.localisation_id ?? "aucun"} open className="grid gap-2">
          <summary className="sticky top-14 z-[5] flex cursor-pointer items-center gap-2 rounded-md bg-background/95 py-2 text-lg font-semibold backdrop-blur md:top-0">
            <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {a.localisation}
            <span className="text-sm font-normal text-muted-foreground">{a.plans.length}</span>
          </summary>
          <ul className="grid gap-2 pt-2">
            {a.plans.map((p) => (
              <li key={p.plan_controle_id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="grid min-w-0 flex-1 gap-1">
                  <Link
                    href={`/controles/plans/${p.plan_controle_id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {p.type_libelle}
                  </Link>
                  <span className="truncate text-sm text-muted-foreground">
                    {[p.equipement_code, p.perimetre].filter(Boolean).join(" — ")}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <BadgeStatut statut={p.statut_echeance} />
                    {p.prochaine_echeance && (
                      <span className="text-muted-foreground">{formaterDate(p.prochaine_echeance)}</span>
                    )}
                    {peutEcrire && (
                      <Link
                        href={`/controles/saisie?plan=${p.plan_controle_id}&retour=${encodeURIComponent(retour)}`}
                        className="text-muted-foreground underline"
                      >
                        Autre résultat
                      </Link>
                    )}
                  </span>
                </div>
                {peutEcrire && <BoutonConforme planId={p.plan_controle_id} />}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
