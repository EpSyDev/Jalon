import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { FUSEAU } from "@/lib/metier/echeance";
import {
  changements,
  LIBELLES_ACTION,
  LIBELLES_TABLE,
  lienEnregistrement,
  titreEnregistrement,
  type Entree,
} from "@/lib/metier/journal";

/** Entrées du journal, lisibles : qui, quand, quoi (avant → après). tableFiche : sur une fiche, la cible n'est rappelée que pour les éléments liés (contrôles, réserves). */
export function ListeJournal({
  entrees,
  noms = {},
  tableFiche,
}: {
  entrees: Entree[];
  /** Libellés des éléments liés (nommerLiens). */
  noms?: Record<string, string>;
  tableFiche?: string;
}) {
  const parId = new Map(Object.entries(noms));
  return (
    <ol className="grid gap-2">
      {entrees.map((e) => {
        const lien = lienEnregistrement(e);
        const titre = titreEnregistrement(e);
        const champs = changements(e, parId);
        const cible = `${LIBELLES_TABLE[e.table_cible] ?? e.table_cible}${titre ? ` — ${titre}` : ""}`;
        return (
          <li key={e.id} className="grid gap-1 rounded-lg border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-medium">
                {LIBELLES_ACTION[e.action]}
                {e.table_cible !== tableFiche && (
                  <>
                    {" · "}
                    {lien && !tableFiche ? (
                      <Link href={lien} className="underline">
                        {cible}
                      </Link>
                    ) : (
                      cible
                    )}
                  </>
                )}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatInTimeZone(new Date(e.cree_le), FUSEAU, "dd/MM/yyyy HH:mm")} · {e.utilisateur_nom ?? "système"}
              </span>
            </div>
            {champs.length > 0 && (
              <ul className="grid gap-0.5 text-muted-foreground">
                {champs.map((c) => (
                  <li key={c.champ}>
                    <span className="text-foreground">{c.champ}</span> : {c.avant} → {c.apres}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Section repliable « Historique des modifications » d'une fiche (administrateurs). */
export function HistoriqueFiche({
  entrees,
  noms,
  table,
}: {
  entrees: Entree[];
  noms?: Record<string, string>;
  table: string;
}) {
  if (entrees.length === 0) return null;
  return (
    <details className="group grid gap-3">
      <summary className="cursor-pointer text-lg font-semibold">
        Historique des modifications{" "}
        <span className="text-sm font-normal text-muted-foreground">({entrees.length})</span>
      </summary>
      <div className="pt-3">
        <ListeJournal entrees={entrees} noms={noms} tableFiche={table} />
      </div>
    </details>
  );
}
