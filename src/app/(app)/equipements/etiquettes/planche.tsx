"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EtiquettePlanche = {
  id: string;
  code: string;
  libelle: string;
  localisation: string | null;
  jeton: string;
  /** Univers et catégorie, pour regrouper la planche à l'écran. */
  groupe: string;
};

const TAILLES = {
  grande: {
    libelle: "Grandes",
    aide: "2 par ligne",
    grille: "grid-cols-1 sm:grid-cols-2 print:grid-cols-2",
    qr: "w-1/2",
    code: "text-lg",
    texte: "text-sm",
  },
  moyenne: {
    libelle: "Moyennes",
    aide: "3 par ligne",
    grille: "grid-cols-2 sm:grid-cols-3 print:grid-cols-3",
    qr: "w-3/5",
    code: "text-base",
    texte: "text-xs",
  },
  petite: {
    libelle: "Petites",
    aide: "5 par ligne",
    grille: "grid-cols-3 sm:grid-cols-5 print:grid-cols-5",
    qr: "w-4/5",
    code: "text-xs",
    texte: "text-[9px] leading-tight",
  },
} as const;

type Taille = keyof typeof TAILLES;

const MEMOIRE = "jalon-planche-qr";

function lireMemoire(): { taille: Taille; localisation: boolean } {
  try {
    const m = JSON.parse(localStorage.getItem(MEMOIRE) ?? "{}");
    return {
      taille: m.taille in TAILLES ? m.taille : "moyenne",
      localisation: typeof m.localisation === "boolean" ? m.localisation : true,
    };
  } catch {
    return { taille: "moyenne", localisation: true };
  }
}

const sAbonner = () => () => {};

/** QR dessiné en SVG (aucune image ni HTML injecté), marge de 2 modules pour la lecture. */
function Qr({ texte, className }: { texte: string; className?: string }) {
  const { taille, chemin } = useMemo(() => {
    const { modules } = QRCode.create(texte, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { taille: modules.size + 4, chemin: d };
  }, [texte]);
  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} shapeRendering="crispEdges" aria-hidden className={className}>
      <rect width={taille} height={taille} fill="#fff" />
      <path d={chemin} fill="#000" />
    </svg>
  );
}

/** Planche d'étiquettes : tout est coché, on décoche ce qu'on ne veut pas imprimer. */
export function PlancheEtiquettes({ etiquettes, base }: { etiquettes: EtiquettePlanche[]; base: string }) {
  // Les QR ne sont dessinés que dans le navigateur : la page reste légère, même pour tout le parc.
  const client = useSyncExternalStore(
    sAbonner,
    () => true,
    () => false,
  );
  const [decochees, setDecochees] = useState<Set<string>>(new Set());
  const [reglages, setReglages] = useState<{ taille: Taille; localisation: boolean } | null>(null);
  const { taille, localisation } = reglages ?? (client ? lireMemoire() : { taille: "moyenne", localisation: true });
  const t = TAILLES[taille];
  const cochees = etiquettes.length - decochees.size;

  const regler = (r: Partial<{ taille: Taille; localisation: boolean }>) => {
    const suivant = { taille, localisation, ...r };
    setReglages(suivant);
    try {
      localStorage.setItem(MEMOIRE, JSON.stringify(suivant));
    } catch {
      // Stockage indisponible (navigation privée) : le réglage vaut pour cette page seulement.
    }
  };
  const basculer = (ids: string[], cocher: boolean) =>
    setDecochees((d) => {
      const n = new Set(d);
      for (const id of ids) {
        if (cocher) n.delete(id);
        else n.add(id);
      }
      return n;
    });

  const groupes = useMemo(() => {
    const m = new Map<string, EtiquettePlanche[]>();
    for (const e of etiquettes) m.set(e.groupe, [...(m.get(e.groupe) ?? []), e]);
    return [...m];
  }, [etiquettes]);

  return (
    <div className="grid gap-4">
      <div className="sticky top-14 z-10 grid gap-3 rounded-lg border bg-card/95 p-3 backdrop-blur-md md:top-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm">
            <span className="font-semibold tabular-nums">{cochees}</span> étiquette{cochees > 1 ? "s" : ""} à imprimer
            sur {etiquettes.length}
          </p>
          <Button variant="outline" className="h-11" onClick={() => setDecochees(new Set())}>
            Tout cocher
          </Button>
          <Button variant="outline" className="h-11" onClick={() => setDecochees(new Set(etiquettes.map((e) => e.id)))}>
            Tout décocher
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Taille des étiquettes</legend>
            {(Object.keys(TAILLES) as Taille[]).map((k) => (
              <label
                key={k}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                  taille === k && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="radio"
                  name="taille"
                  checked={taille === k}
                  onChange={() => regler({ taille: k })}
                  className="accent-[var(--primary)]"
                />
                {TAILLES[k].libelle}
                <span className="text-xs text-muted-foreground">{TAILLES[k].aide}</span>
              </label>
            ))}
          </fieldset>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={localisation}
              onChange={(e) => regler({ localisation: e.target.checked })}
              className="size-4 accent-[var(--primary)]"
            />
            Localisation sur l&apos;étiquette
          </label>
          <Button className="ml-auto h-11" disabled={cochees === 0} onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Imprimer ({cochees})
          </Button>
        </div>
      </div>

      <ul className={cn("planche-a4 grid gap-3 print:gap-0", t.grille)}>
        {groupes.map(([groupe, liste]) => {
          const nonCochees = liste.filter((e) => decochees.has(e.id)).length;
          return [
            groupes.length > 1 && (
              <li
                key={`groupe-${groupe}`}
                className="col-span-full flex flex-wrap items-center justify-between gap-2 border-b pt-2 pb-1 print:hidden"
              >
                <span className="font-semibold">
                  {groupe}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {liste.length - nonCochees}/{liste.length}
                  </span>
                </span>
                <button
                  type="button"
                  className="min-h-11 text-sm underline"
                  onClick={() =>
                    basculer(
                      liste.map((e) => e.id),
                      nonCochees > 0,
                    )
                  }
                >
                  {nonCochees > 0 ? "Cocher le groupe" : "Décocher le groupe"}
                </button>
              </li>
            ),
            ...liste.map((e) => {
              const cochee = !decochees.has(e.id);
              return (
                <li key={e.id} className={cn("break-inside-avoid", !cochee && "print:hidden")}>
                  <label
                    className={cn(
                      "relative grid h-full cursor-pointer justify-items-center gap-1 rounded-lg border bg-white p-3 text-center text-black",
                      "print:cursor-auto print:rounded-none print:border-dashed print:border-neutral-400 print:p-[2mm]",
                      cochee ? "border-neutral-300" : "opacity-35 grayscale",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={cochee}
                      onChange={(ev) => basculer([e.id], ev.target.checked)}
                      aria-label={`Imprimer l'étiquette ${e.code}`}
                      className="absolute top-2 left-2 size-5 accent-[var(--primary)] print:hidden"
                    />
                    {client ? (
                      <Qr texte={`${base}/q/${e.jeton}`} className={cn("aspect-square", t.qr)} />
                    ) : (
                      <span className={cn("aspect-square bg-neutral-100", t.qr)} />
                    )}
                    <span className={cn("font-bold break-all", t.code)}>{e.code}</span>
                    <span className={cn("line-clamp-2", t.texte)}>{e.libelle}</span>
                    {localisation && e.localisation && (
                      <span className={cn("line-clamp-1 text-neutral-600", t.texte)}>{e.localisation}</span>
                    )}
                  </label>
                </li>
              );
            }),
          ];
        })}
      </ul>
    </div>
  );
}
