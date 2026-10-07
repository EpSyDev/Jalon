"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckSquare, ChevronRight, X } from "lucide-react";
import { BadgeStatut } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { EquipementListe } from "@/lib/requetes/parc";
import { cn } from "@/lib/utils";
import { modifierEquipementsEnMasse } from "./actions";
import { LIBELLES_STATUT_EQUIPEMENT } from "./champs-equipement";

type Option = { id: string; libelle: string };

function Choix({ nom, libelle, aucun, options }: { nom: string; libelle: string; aucun?: string; options: Option[] }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {libelle}
      <NativeSelect name={nom} defaultValue="" className="w-full [&_select]:h-11 [&_select]:text-base">
        <NativeSelectOption value="">Inchangé</NativeSelectOption>
        {aucun && <NativeSelectOption value="aucun">{aucun}</NativeSelectOption>}
        {options.map((o) => (
          <NativeSelectOption key={o.id} value={o.id}>
            {o.libelle}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

/** Liste du parc ; en mode sélection, modification groupée de l'univers, de la localisation ou du statut. */
export function ListeEquipements({
  equipements,
  univers,
  localisations,
  peutEcrire,
}: {
  equipements: EquipementListe[];
  univers: Option[];
  localisations: Option[];
  peutEcrire: boolean;
}) {
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [retour, setRetour] = useState<{ erreur?: string; message?: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="grid gap-3">
      {peutEcrire && (
        <div className="flex flex-wrap items-center gap-2">
          {selection ? (
            <>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setSelection(new Set(equipements.map((e) => e.id)))}
              >
                Tout sélectionner ({equipements.length})
              </Button>
              <Button
                variant="ghost"
                className="h-11"
                onClick={() => {
                  setSelection(null);
                  setRetour(null);
                }}
              >
                <X className="size-4" aria-hidden />
                Terminer
              </Button>
            </>
          ) : (
            <Button variant="outline" className="h-11" onClick={() => setSelection(new Set())}>
              <CheckSquare className="size-4" aria-hidden />
              Sélectionner pour déplacer ou changer le statut
            </Button>
          )}
        </div>
      )}

      {retour?.message && (
        <p role="status" className="rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {retour.message}
        </p>
      )}

      <ul className={cn("grid gap-2", selection && selection.size > 0 && "pb-72 md:pb-40")}>
        {equipements.map((e) => {
          const contenu = (
            <>
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="font-medium">
                  {e.code} — {e.libelle}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {[e.univers, e.localisation, e.famille].filter(Boolean).join(" · ") || "Sans localisation"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.statut !== "en_service" && <Badge variant="outline">{LIBELLES_STATUT_EQUIPEMENT[e.statut]}</Badge>}
                  {e.synthese && <BadgeStatut statut={e.synthese} />}
                  {e.statuts_plans.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {e.statuts_plans.length} contrôle{e.statuts_plans.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </>
          );
          return (
            <li key={e.id}>
              {selection ? (
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-4",
                    selection.has(e.id) && "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[var(--primary)]"
                    checked={selection.has(e.id)}
                    onChange={() => basculer(e.id)}
                  />
                  {contenu}
                </label>
              ) : (
                <Link
                  href={`/equipements/${e.id}`}
                  className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
                >
                  {contenu}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {selection && selection.size > 0 && (
        <form
          aria-label="Modifier la sélection"
          className="fixed inset-x-0 bottom-16 z-20 grid gap-3 border-t bg-card p-4 shadow-lg md:bottom-0 md:left-60 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-end"
          onSubmit={(ev) => {
            ev.preventDefault();
            const donnees = new FormData(ev.currentTarget);
            for (const id of selection) donnees.append("ids", id);
            demarrer(async () => {
              const r = await modifierEquipementsEnMasse(donnees);
              if (r && "erreur" in r) setRetour({ erreur: r.erreur });
              else {
                setRetour({ message: r?.message });
                setSelection(new Set());
              }
            });
          }}
        >
          <p className="text-sm font-semibold md:self-center">
            {selection.size} sélectionné{selection.size > 1 ? "s" : ""}
          </p>
          <Choix nom="univers_id" libelle="Univers" aucun="Sans univers" options={univers} />
          <Choix nom="localisation_id" libelle="Localisation" aucun="Sans localisation" options={localisations} />
          <Choix
            nom="statut"
            libelle="Statut"
            options={Object.entries(LIBELLES_STATUT_EQUIPEMENT).map(([id, libelle]) => ({ id, libelle }))}
          />
          <Button type="submit" className="h-11" disabled={enCours}>
            {enCours ? "Application…" : "Appliquer"}
          </Button>
          {retour?.erreur && (
            <p role="alert" className="text-sm text-destructive md:col-span-5">
              {retour.erreur}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
