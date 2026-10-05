"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { analyserImport, importer, type Apercu } from "./actions";

const TYPES = [
  { valeur: "controles", libelle: "Contrôles (annexe A)" },
  { valeur: "equipements", libelle: "Équipements" },
] as const;

const STATUTS = {
  creation: { libelle: "À créer", icone: CircleCheck, classe: "text-emerald-700 dark:text-emerald-400" },
  ignoree: { libelle: "Déjà présent", icone: CircleMinus, classe: "text-muted-foreground" },
  erreur: { libelle: "Erreur", icone: CircleAlert, classe: "text-destructive" },
} as const;

export function FormulaireImport() {
  const formulaire = useRef<HTMLFormElement>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [message, setMessage] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [filtreErreurs, setFiltreErreurs] = useState(false);

  function lancer(action: typeof analyserImport) {
    if (!formulaire.current) return;
    const donnees = new FormData(formulaire.current);
    demarrer(async () => {
      const r = await action(donnees);
      if ("erreur" in r) {
        setMessage({ ton: "erreur", texte: r.erreur });
        setApercu(null);
      } else if (r.importe) {
        setMessage({ ton: "succes", texte: r.importe });
        setApercu(null);
        formulaire.current?.reset();
      } else if (r.apercu) {
        setMessage(null);
        setApercu(r.apercu);
        setFiltreErreurs(!r.apercu.importable);
      }
    });
  }

  const nbErreurs = apercu?.lignes.filter((l) => l.statut === "erreur").length ?? 0;
  const lignes = apercu ? (filtreErreurs ? apercu.lignes.filter((l) => l.statut === "erreur") : apercu.lignes) : [];

  return (
    <div className="grid gap-6">
      <form
        ref={formulaire}
        className="grid gap-4 rounded-lg border p-4"
        onChange={() => setApercu(null)}
        onSubmit={(e) => {
          e.preventDefault();
          lancer(analyserImport);
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Contenu du fichier</legend>
          {TYPES.map((t, i) => (
            <label key={t.valeur} className="flex min-h-11 items-center gap-3 text-base">
              <input type="radio" name="type" value={t.valeur} defaultChecked={i === 0} className="size-5" />
              {t.libelle}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="fichier">Fichier .xlsx ou .csv (5 Mo maximum)</Label>
          <input
            id="fichier"
            name="fichier"
            type="file"
            required
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="w-full min-w-0 rounded-lg border p-3 text-base file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5"
          />
        </div>
        <Button type="submit" disabled={enCours} className="h-12 text-base">
          {enCours && !apercu ? "Analyse…" : "Analyser le fichier"}
        </Button>
      </form>

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

      {apercu && (
        <section className="grid gap-4" aria-label="Aperçu de l'import">
          {apercu.importable ? (
            <div className="grid gap-3 rounded-lg border border-emerald-600/40 p-4">
              <p className="font-medium">Prêt à importer :</p>
              <ul className="list-disc pl-5 text-sm">
                {apercu.creations.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <Button onClick={() => lancer(importer)} disabled={enCours} className="h-12 text-base">
                {enCours ? "Import…" : "Confirmer l'import"}
              </Button>
            </div>
          ) : (
            <p role="alert" className="rounded-lg bg-destructive/10 p-4 text-destructive">
              {nbErreurs > 0
                ? `${nbErreurs} ligne(s) en erreur : rien ne sera importé. Corrigez le fichier puis relancez l'analyse.`
                : "Rien de nouveau à importer : toutes les lignes sont déjà présentes."}
            </p>
          )}

          {nbErreurs > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filtreErreurs} onChange={(e) => setFiltreErreurs(e.target.checked)} />
              Afficher uniquement les erreurs
            </label>
          )}

          <ol className="grid gap-2">
            {lignes.map((l) => {
              const s = STATUTS[l.statut];
              return (
                <li key={l.numero} className="grid gap-1 rounded-lg border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <s.icone className={cn("mt-0.5 size-4 shrink-0", s.classe)} aria-hidden />
                    <span className="text-muted-foreground">Ligne {l.numero}</span>
                    <span className={cn("ml-auto shrink-0 font-medium", s.classe)}>{s.libelle}</span>
                  </div>
                  {l.resume && <div>{l.resume}</div>}
                  {l.erreurs.length > 0 && (
                    <ul className="list-disc pl-5 text-destructive">
                      {l.erreurs.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
