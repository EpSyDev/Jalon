import Link from "next/link";
import { CircleCheck, Plus } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  formaterValeur,
  libelleSeuils,
  LIBELLES_STATUT_RELEVE,
  ORDRE_STATUT_RELEVE,
  prochainReleve,
  type StatutReleve,
} from "@/lib/metier/releves";
import { avecEtat, listerPoints } from "@/lib/requetes/releves";
import { cn } from "@/lib/utils";
import { SaisieRapide } from "./saisie-rapide";

export const metadata = { title: "Relevés — Jalon" };

const STYLE_STATUT: Record<StatutReleve, string> = {
  en_retard: "bg-red-600 text-white dark:bg-red-500 border-transparent",
  jamais: "bg-violet-600 text-white dark:bg-violet-500 border-transparent",
  du_jour: "bg-amber-400 text-black border-transparent",
  a_jour: "bg-emerald-600 text-white dark:bg-emerald-500 border-transparent",
};

/** Relevés périodiques : ce qu'il faut lire aujourd'hui, saisie en une touche. */
export default async function PageReleves() {
  const aujourdhui = aujourdhuiParis();
  const { points, peutEcrire } = await requete(async (tx, u) => ({
    points: (await listerPoints(tx, true)).map((p) => avecEtat(p, aujourdhui)),
    peutEcrire: u.role !== "lecture",
  }));
  const tries = [...points].sort(
    (a, b) => ORDRE_STATUT_RELEVE.indexOf(a.statut) - ORDRE_STATUT_RELEVE.indexOf(b.statut),
  );

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Relevés</h1>
        {peutEcrire && (
          <LienBouton href="/releves/nouveau">
            <Plus className="size-4" aria-hidden />
            Nouveau point de relevé
          </LienBouton>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Températures, pressions, compteurs… Les seuils sont ceux que vous définissez : Jalon n&apos;en propose aucun.
      </p>

      {tries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Aucun point de relevé. Créez-en un pour suivre une valeur à intervalle régulier.
        </p>
      ) : (
        <ul className="grid gap-3">
          {tries.map((p) => {
            const seuils = libelleSeuils(p.seuil_min, p.seuil_max, p.unite);
            const prochain = prochainReleve(p.dernier_releve, p.periodicite_jours);
            return (
              <li key={p.id} className="grid gap-3 rounded-lg border bg-card p-3">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/releves/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                      {p.libelle}
                    </Link>
                    <Badge className={cn(STYLE_STATUT[p.statut])}>{LIBELLES_STATUT_RELEVE[p.statut]}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {[
                      p.equipement_code,
                      p.localisation,
                      `tous les ${p.periodicite_jours} jour${p.periodicite_jours > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="text-sm">
                    {p.derniere_valeur === null ? (
                      "Aucun relevé"
                    ) : (
                      <>
                        Dernier : <span className="font-medium">{formaterValeur(p.derniere_valeur, p.unite)}</span> le{" "}
                        {formaterDate(p.dernier_releve)}
                      </>
                    )}
                    {prochain && p.statut !== "du_jour" && ` · prochain le ${formaterDate(prochain)}`}
                  </span>
                  {p.hors_seuil && (
                    <span role="alert" className="text-sm font-medium text-destructive">
                      Dernière valeur {p.hors_seuil === "bas" ? "sous" : "au-dessus de"} la limite
                      {seuils && ` (${seuils})`}
                    </span>
                  )}
                  {!p.hors_seuil && seuils && <span className="text-sm text-muted-foreground">Seuils : {seuils}</span>}
                </div>
                {peutEcrire && <SaisieRapide pointId={p.id} unite={p.unite} libelle={p.libelle} />}
              </li>
            );
          })}
        </ul>
      )}

      {tries.length > 0 && tries.every((p) => p.statut === "a_jour" && !p.hors_seuil) && (
        <p className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <CircleCheck className="size-5 text-emerald-600" aria-hidden />
          Tous les relevés sont à jour.
        </p>
      )}
    </div>
  );
}
