"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Building2,
  ClipboardCheck,
  FileText,
  HardHat,
  Search,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ResultatRecherche } from "@/app/api/recherche/route";
import { cn } from "@/lib/utils";

const TYPES: Record<string, { libelle: string; icone: LucideIcon }> = {
  equipement: { libelle: "Équipement", icone: Boxes },
  plan: { libelle: "Contrôle", icone: ClipboardCheck },
  reserve: { libelle: "Réserve", icone: TriangleAlert },
  prestataire: { libelle: "Prestataire", icone: Building2 },
  contrat: { libelle: "Contrat", icone: FileText },
  intervention: { libelle: "Intervention", icone: Wrench },
  chantier: { libelle: "Chantier", icone: HardHat },
};

const EVENEMENT_OUVERTURE = "jalon:recherche";

/** Bouton d'ouverture de la recherche (barre sur ordinateur, icône sur mobile). */
export function BoutonRecherche({ variante }: { variante: "barre" | "icone" }) {
  const ouvrir = () => window.dispatchEvent(new Event(EVENEMENT_OUVERTURE));
  return variante === "barre" ? (
    <button
      type="button"
      onClick={ouvrir}
      className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
    >
      <Search className="size-4" aria-hidden />
      Rechercher…
      <kbd className="ml-auto rounded border px-1.5 text-xs">Ctrl K</kbd>
    </button>
  ) : (
    <button
      type="button"
      onClick={ouvrir}
      aria-label="Rechercher"
      className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
    >
      <Search className="size-6" aria-hidden />
    </button>
  );
}

/** Fenêtre de recherche globale, unique dans la page (Ctrl+K, ⌘K ou « / »). */
export function FenetreRecherche() {
  const dialogue = useRef<HTMLDialogElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  // Résultats associés au terme qui les a produits : évite « Aucun résultat » pendant la saisie.
  const [reponse, setReponse] = useState<{ terme: string; liste: ResultatRecherche[] }>({ terme: "", liste: [] });
  const [actif, setActif] = useState(0);
  const tropCourt = q.trim().length < 2;
  const terme = q.trim();
  const resultats = tropCourt ? [] : reponse.liste;
  const aJour = reponse.terme === terme;
  const [etat, setEtat] = useState<"repos" | "chargement" | "erreur">("repos");

  const ouvrir = useCallback(() => {
    dialogue.current?.showModal();
    champ.current?.select();
  }, []);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      const saisie = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !saisie)) {
        e.preventDefault();
        ouvrir();
      }
    }
    window.addEventListener("keydown", surTouche);
    window.addEventListener(EVENEMENT_OUVERTURE, ouvrir);
    return () => {
      window.removeEventListener("keydown", surTouche);
      window.removeEventListener(EVENEMENT_OUVERTURE, ouvrir);
    };
  }, [ouvrir]);

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) return;
    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      setEtat("chargement");
      try {
        const http = await fetch(`/api/recherche?q=${encodeURIComponent(terme)}`, { signal: controleur.signal });
        if (!http.ok || !http.headers.get("content-type")?.includes("json")) throw new Error();
        setReponse({ terme, liste: await http.json() });
        setActif(0);
        setEtat("repos");
      } catch {
        if (!controleur.signal.aborted) setEtat("erreur");
      }
    }, 150);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [q]);

  function aller(r: ResultatRecherche | undefined) {
    if (!r) return;
    dialogue.current?.close();
    setQ("");
    router.push(r.lien);
  }

  return (
    <dialog
      ref={dialogue}
      aria-label="Recherche globale"
      className="m-0 mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40 max-md:mt-4"
      onClick={(e) => e.target === dialogue.current && dialogue.current.close()}
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={champ}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActif((a) => Math.min(a + 1, resultats.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActif((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              aller(resultats[actif]);
            }
          }}
          placeholder="Équipement, contrôle, prestataire, contrat…"
          aria-label="Rechercher"
          role="combobox"
          aria-expanded={resultats.length > 0}
          aria-controls="resultats-recherche"
          aria-activedescendant={resultats[actif] ? `resultat-${actif}` : undefined}
          className="h-14 w-full bg-transparent text-base outline-none"
          autoComplete="off"
        />
      </div>
      <ul id="resultats-recherche" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
        {resultats.map((r, i) => {
          const { libelle, icone: Icone } = TYPES[r.type] ?? { libelle: r.type, icone: Search };
          return (
            <li
              key={`${r.type}-${r.id}`}
              id={`resultat-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseEnter={() => setActif(i)}
              onClick={() => aller(r)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-lg p-3", i === actif && "bg-muted")}
            >
              <Icone className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-medium">{r.titre}</span>
                {r.sous_titre && <span className="truncate text-sm text-muted-foreground">{r.sous_titre}</span>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{libelle}</span>
            </li>
          );
        })}
        {!tropCourt && aJour && etat === "repos" && resultats.length === 0 && (
          <li className="p-6 text-center text-muted-foreground">Aucun résultat.</li>
        )}
        {!tropCourt && etat === "erreur" && (
          <li className="p-6 text-center text-destructive">Recherche indisponible.</li>
        )}
        {tropCourt && <li className="p-6 text-center text-sm text-muted-foreground">Tapez au moins 2 caractères.</li>}
      </ul>
    </dialog>
  );
}
