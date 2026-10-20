import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  joursAvantEcheance,
  LIBELLES_STATUT_FORMATION,
  statutFormation,
  type StatutFormation,
} from "@/lib/metier/formations";
import { seuilAEcheance } from "@/lib/requetes/contrats";
import { formationsActuelles } from "@/lib/requetes/formations";
import { cn } from "@/lib/utils";

export const metadata = { title: "Formations — Jalon" };

const STYLE: Record<StatutFormation, string> = {
  expiree: "border-red-600 text-red-700 dark:text-red-400",
  bientot: "border-amber-500 text-amber-800 dark:text-amber-300",
  valide: "border-emerald-600/40 text-emerald-800 dark:text-emerald-300",
  sans_echeance: "border-border text-muted-foreground",
};

export default async function PageFormations() {
  const aujourdhui = aujourdhuiParis();
  const { formations, seuil, peutEcrire } = await requete(async (tx, u) => ({
    formations: await formationsActuelles(tx),
    seuil: await seuilAEcheance(tx),
    peutEcrire: u.role !== "lecture",
  }));
  const lignes = formations.map((f) => ({ ...f, statut: statutFormation(f.echeance, aujourdhui, seuil) }));
  const nbExpirees = lignes.filter((l) => l.statut === "expiree").length;
  const nbBientot = lignes.filter((l) => l.statut === "bientot").length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Formations</h1>
        {peutEcrire && (
          <LienBouton href="/formations/nouvelle">
            <Plus className="size-4" aria-hidden />
            Formation suivie
          </LienBouton>
        )}
      </div>

      {(nbExpirees > 0 || nbBientot > 0) && (
        <p
          role="status"
          className={cn(
            "rounded-md p-3 text-sm",
            nbExpirees > 0 ? "bg-red-600/10 text-red-800 dark:text-red-300" : "bg-amber-400/20",
          )}
        >
          {[
            nbExpirees > 0 && `${nbExpirees} expirée${nbExpirees > 1 ? "s" : ""}`,
            nbBientot > 0 && `${nbBientot} à renouveler dans les ${seuil} jours`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {lignes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune formation suivie. Ajoutez une formation avec l&apos;agent, la date et la durée : si la formation a une
          validité (3 ans pour l&apos;habilitation électrique, par exemple), l&apos;échéance se calcule toute seule.
        </p>
      ) : (
        <ul className="grid gap-2">
          {lignes.map((l) => {
            const jours = l.echeance ? joursAvantEcheance(l.echeance, aujourdhui) : null;
            return (
              <li key={l.id}>
                <Link
                  href={peutEcrire ? `/formations/${l.id}` : "#"}
                  aria-disabled={!peutEcrire}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50"
                >
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="font-medium">
                      {l.agent_nom} <span className="text-muted-foreground">· {l.type_libelle}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className={STYLE[l.statut]}>
                        {LIBELLES_STATUT_FORMATION[l.statut]}
                      </Badge>
                      <span className="text-muted-foreground">
                        {l.echeance &&
                          (jours !== null && jours < 0
                            ? `expirée depuis le ${formaterDate(l.echeance)}`
                            : `valable jusqu'au ${formaterDate(l.echeance)}`)}
                        {l.echeance && " · "}
                        suivie le {formaterDate(l.date_formation)}
                        {l.duree_heures !== null && ` · ${l.duree_heures} h`}
                        {l.organisme && ` · ${l.organisme}`}
                      </span>
                    </span>
                  </span>
                  {peutEcrire && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {peutEcrire && (
        <Link href="/formations/referentiel" className="text-sm underline">
          Agents et formations (durées de validité)
        </Link>
      )}
    </div>
  );
}
