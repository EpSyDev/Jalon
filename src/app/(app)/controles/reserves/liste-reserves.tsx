"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formaterDate, LIBELLES_GRAVITE } from "@/lib/format";
import { normaliser } from "@/lib/metier/import";
import type { ReserveListe } from "@/lib/requetes/controles";
import { cn } from "@/lib/utils";
import { leverReserves } from "../actions";

const CHAMP = "h-11 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base";

export function ListeReserves({
  reserves,
  peutEcrire,
  aujourdhui,
}: {
  reserves: ReserveListe[];
  peutEcrire: boolean;
  aujourdhui: string;
}) {
  const [type, setType] = useState("");
  const [recherche, setRecherche] = useState("");
  const [cochees, setCochees] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(aujourdhui);
  const [commentaire, setCommentaire] = useState("");
  const [message, setMessage] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const types = useMemo(() => [...new Set(reserves.map((r) => r.type_libelle))].sort(), [reserves]);
  const visibles = useMemo(() => {
    const mots = normaliser(recherche).split(" ").filter(Boolean);
    return reserves.filter((r) => {
      if (type && r.type_libelle !== type) return false;
      const texte = normaliser(`${r.description} ${r.perimetre}`);
      return mots.every((m) => texte.includes(m));
    });
  }, [reserves, type, recherche]);
  const toutesVisiblesCochees = visibles.length > 0 && visibles.every((r) => cochees.has(r.id));

  function basculer(ids: string[], cocher: boolean) {
    setCochees((c) => {
      const n = new Set(c);
      ids.forEach((id) => (cocher ? n.add(id) : n.delete(id)));
      return n;
    });
  }

  function lever() {
    demarrer(async () => {
      const r = await leverReserves({ ids: [...cochees], date_levee: date, commentaire });
      if (r && "erreur" in r) setMessage({ ton: "erreur", texte: r.erreur });
      else {
        setMessage({ ton: "succes", texte: r?.message ?? "Réserves levées." });
        setCochees(new Set());
        setCommentaire("");
      }
    });
  }

  if (reserves.length === 0) return <p className="text-muted-foreground">Aucune réserve ouverte.</p>;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="filtre-type">Type de contrôle</Label>
          <NativeSelect
            id="filtre-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full [&_select]:h-11"
          >
            <NativeSelectOption value="">Tous ({reserves.length})</NativeSelectOption>
            {types.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {`${t} (${reserves.filter((r) => r.type_libelle === t).length})`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtre-texte">Rechercher</Label>
          <input
            id="filtre-texte"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Ex. : rouille, UG12…"
            className={CHAMP}
          />
        </div>
      </div>

      {message && (
        <p
          role={message.ton === "erreur" ? "alert" : "status"}
          className={cn(
            "rounded-lg p-4",
            message.ton === "erreur"
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
          )}
        >
          {message.texte}
        </p>
      )}

      {peutEcrire && (
        <div className="sticky top-0 z-10 grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={toutesVisiblesCochees}
              onChange={(e) =>
                basculer(
                  visibles.map((r) => r.id),
                  e.target.checked,
                )
              }
            />
            {`Cocher les ${visibles.length} réserve(s) affichée(s)`}
          </label>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="date-levee">Date de levée</Label>
              <input
                id="date-levee"
                type="date"
                max={aujourdhui}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={CHAMP}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="commentaire-levee">Commentaire (facultatif)</Label>
              <input
                id="commentaire-levee"
                value={commentaire}
                maxLength={500}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ex. : pièces changées, devis n° …"
                className={CHAMP}
              />
            </div>
            <Button onClick={lever} disabled={enCours || cochees.size === 0} className="h-11">
              {enCours ? "Levée…" : `Lever ${cochees.size} réserve${cochees.size > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      )}

      <ul className="grid gap-2">
        {visibles.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
            {peutEcrire && (
              <input
                type="checkbox"
                aria-label={`Cocher : ${r.description}`}
                className="mt-0.5 size-5 shrink-0"
                checked={cochees.has(r.id)}
                onChange={(e) => basculer([r.id], e.target.checked)}
              />
            )}
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Link href={`/controles/reserves/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                {r.description}
              </Link>
              <span className="text-muted-foreground">
                {[
                  r.perimetre,
                  r.type_libelle,
                  `constatée le ${formaterDate(r.date_constat)}`,
                  r.gravite && LIBELLES_GRAVITE[r.gravite],
                  r.echeance_levee && `à lever avant le ${formaterDate(r.echeance_levee)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
