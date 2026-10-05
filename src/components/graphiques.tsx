"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Graphiques sans bibliothèque : barres fines, extrémités arrondies ancrées à la ligne de base,
// grille discrète, info-bulle au survol, tableau de données accessible.

type Serie = { nom: string; couleur: "serie-1" | "serie-2" };
export type PointHistogramme = { etiquette: string; libelle: string; valeurs: number[]; complement?: string };

const FOND: Record<Serie["couleur"], string> = { "serie-1": "bg-serie-1", "serie-2": "bg-serie-2" };

function Legende({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      {series.map((s) => (
        <li key={s.nom} className="flex items-center gap-2">
          <span className={cn("size-3 rounded-sm", FOND[s.couleur])} aria-hidden />
          {s.nom}
        </li>
      ))}
    </ul>
  );
}

function TableauDonnees({ series, points, unite }: { series: Serie[]; points: PointHistogramme[]; unite: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">Voir le tableau</summary>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-1 font-medium">Mois</th>
            {series.map((s) => (
              <th key={s.nom} className="py-1 text-right font-medium">
                {s.nom} ({unite})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.libelle} className="border-b border-border/50">
              <td className="py-1">{p.libelle}</td>
              {p.valeurs.map((v, i) => (
                <td key={i} className="py-1 text-right tabular-nums">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Histogramme mensuel, 1 ou 2 séries de même unité (barres groupées, jamais deux axes). */
export function Histogramme({
  titre,
  unite,
  series,
  points,
}: {
  titre: string;
  unite: string;
  series: Serie[];
  points: PointHistogramme[];
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => p.valeurs));
  // Graduations entières (on compte des objets) : 0, moitié, maximum arrondi au pair.
  const plafond = Math.max(2, Math.ceil(max / 2) * 2);
  const total = points.reduce((n, p) => n + p.valeurs[0], 0);

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{titre}</span>
        <span className="text-sm text-muted-foreground">
          {total} {series.length > 1 ? series[0].nom.toLowerCase() : unite} sur 12 mois
        </span>
      </figcaption>
      <Legende series={series} />
      <div className="relative grid grid-cols-[auto_1fr] gap-2">
        <div
          className="flex h-40 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums"
          aria-hidden
        >
          <span>{plafond.toLocaleString("fr-FR")}</span>
          <span>{(plafond / 2).toLocaleString("fr-FR")}</span>
          <span>0</span>
        </div>
        <div className="relative h-40">
          {/* Grille discrète */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            <div className="border-t border-dashed border-border" />
            <div className="border-t border-dashed border-border" />
            <div className="border-t border-border" />
          </div>
          <div
            className="relative flex h-full items-end"
            role="img"
            aria-label={`${titre} : ${points.map((p) => `${p.libelle} ${p.valeurs.join(" / ")}`).join(", ")}`}
          >
            {points.map((p, i) => (
              <div
                key={p.libelle}
                className={cn(
                  "flex h-full flex-1 items-end justify-center gap-0.5 px-0.5",
                  survol === i && "bg-muted/60",
                )}
                onMouseEnter={() => setSurvol(i)}
                onMouseLeave={() => setSurvol(null)}
                onClick={() => setSurvol(survol === i ? null : i)}
              >
                {p.valeurs.map((v, j) => (
                  <div
                    key={j}
                    className={cn("w-full max-w-4 rounded-t", FOND[series[j].couleur], v === 0 && "opacity-0")}
                    style={{ height: `${(v / plafond) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                  />
                ))}
              </div>
            ))}
          </div>
          {survol !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 min-w-36 -translate-y-full rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md"
              style={{
                left: `clamp(0px, calc(${((survol + 0.5) / points.length) * 100}% - 4.5rem), calc(100% - 9rem))`,
              }}
            >
              <div className="font-medium first-letter:uppercase">{points[survol].libelle}</div>
              {series.map((s, j) => (
                <div key={s.nom} className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-sm", FOND[s.couleur])} aria-hidden />
                  {s.nom} : <span className="font-medium tabular-nums">{points[survol].valeurs[j]}</span>
                </div>
              ))}
              {points[survol].complement && <div className="text-muted-foreground">{points[survol].complement}</div>}
            </div>
          )}
        </div>
        <div />
        <div className="flex text-[10px] text-muted-foreground sm:text-xs" aria-hidden>
          {points.map((p) => (
            <span key={p.libelle} className="flex-1 text-center">
              {p.etiquette}
            </span>
          ))}
        </div>
      </div>
      <TableauDonnees series={series} points={points} unite={unite} />
    </figure>
  );
}

/** Barres horizontales pour une petite liste ordonnée (valeur affichée en clair). */
export function BarresHorizontales({
  titre,
  lignes,
  vide,
}: {
  titre: string;
  lignes: { libelle: string; valeur: number; affichage: string; detail?: string }[];
  vide: ReactNode;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <figure className="grid gap-3">
      <figcaption className="font-medium">{titre}</figcaption>
      {lignes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vide}</p>
      ) : (
        <ul className="grid gap-2">
          {lignes.map((l) => (
            <li key={l.libelle} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
              <span>{l.libelle}</span>
              <span className="h-3 rounded-r bg-muted" aria-hidden>
                <span className="block h-full rounded-r bg-serie-1" style={{ width: `${(l.valeur / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">
                {l.affichage}
                {l.detail && <span className="block text-xs text-muted-foreground">{l.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
