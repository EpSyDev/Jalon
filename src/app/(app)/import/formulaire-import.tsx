"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Correspondance, DemandeCorrespondance } from "@/lib/metier/import";
import { analyserImport, importer, type Apercu } from "./actions";

const TYPES = [
  { valeur: "equipements", libelle: "Équipements (fauteuils, matériel biomédical, etc.)" },
  { valeur: "controles", libelle: "Contrôles (annexe A)" },
] as const;

const STATUTS = {
  creation: { libelle: "À créer", icone: CircleCheck, classe: "text-emerald-700 dark:text-emerald-400" },
  ignoree: { libelle: "Déjà présent", icone: CircleMinus, classe: "text-muted-foreground" },
  erreur: { libelle: "Erreur", icone: CircleAlert, classe: "text-destructive" },
} as const;

export function FormulaireImport({ univers }: { univers: { id: string; libelle: string }[] }) {
  const [type, setType] = useState<"controles" | "equipements">("controles");
  // Classeur à plusieurs feuilles : l'utilisateur choisit celle à importer.
  const [feuilles, setFeuilles] = useState<string[] | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [message, setMessage] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [filtreErreurs, setFiltreErreurs] = useState(false);
  // Association des colonnes : proposée par l'outil, ajustable par l'utilisateur.
  const [demande, setDemande] = useState<DemandeCorrespondance | null>(null);
  const [choix, setChoix] = useState<Correspondance>({});
  const [correspondance, setCorrespondance] = useState<Correspondance | null>(null);
  const [edition, setEdition] = useState(false);

  function lancer(action: typeof analyserImport, assoc: Correspondance | null = correspondance) {
    if (!formulaire.current) return;
    const donnees = new FormData(formulaire.current);
    if (assoc) donnees.set("correspondance", JSON.stringify(assoc));
    demarrer(async () => {
      const r = await action(donnees);
      if (r.erreur !== undefined) {
        setApercu(null);
        if (r.demande) {
          setDemande(r.demande);
          setChoix(Object.fromEntries(r.demande.champs.map((c) => [c.cle, c.choix])));
          setEdition(true);
          setMessage({
            ton: "erreur",
            texte: "Je n'ai pas reconnu toutes les colonnes obligatoires : associez-les ci-dessous.",
          });
        } else {
          setFeuilles(r.feuilles ?? null);
          setMessage({ ton: "erreur", texte: r.erreur });
        }
      } else if (r.importe) {
        setMessage({ ton: "succes", texte: r.importe });
        setApercu(null);
        formulaire.current?.reset();
      } else if (r.apercu) {
        setMessage(null);
        setEdition(false);
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
        className="grid gap-4 rounded-lg border bg-card p-4"
        onChange={(e) => {
          const cible = e.target as unknown as HTMLInputElement;
          if (cible.name === "type") setType(cible.value as "controles" | "equipements");
          if (cible.name === "feuille") return;
          setFeuilles(null);
          setApercu(null);
          setDemande(null);
          setCorrespondance(null);
          setEdition(false);
        }}
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
          <Label htmlFor="fichier">Fichier .xlsx, .xlsm ou .csv (5 Mo maximum)</Label>
          <input
            id="fichier"
            name="fichier"
            type="file"
            required
            accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="w-full min-w-0 rounded-lg border p-3 text-base file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5"
          />
        </div>
        {feuilles && (
          <div className="grid gap-2">
            <Label htmlFor="feuille">Feuille à importer</Label>
            <NativeSelect id="feuille" name="feuille" defaultValue={feuilles[0]} className="w-full [&_select]:h-12">
              {feuilles.map((f) => (
                <NativeSelectOption key={f} value={f}>
                  {f}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
        {type === "equipements" && (
          <fieldset className="grid gap-4 rounded-lg border border-dashed p-4">
            <legend className="px-2 text-sm font-medium">Si le fichier n&apos;a pas ces informations</legend>
            <div className="grid gap-2">
              <Label htmlFor="univers_defaut">Univers de tous ces équipements</Label>
              <NativeSelect
                id="univers_defaut"
                name="univers_defaut"
                defaultValue=""
                className="w-full [&_select]:h-12"
              >
                <NativeSelectOption value="">Selon la colonne « Univers » du fichier, sinon aucun</NativeSelectOption>
                {univers.map((u) => (
                  <NativeSelectOption key={u.id} value={u.id}>
                    {u.libelle}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="text-xs text-muted-foreground">
                Ex. : choisissez « FAUTEUILS ROULANTS » : chaque ligne y sera rangée.
              </span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prefixe_code">Préfixe des codes à générer</Label>
              <input
                id="prefixe_code"
                name="prefixe_code"
                maxLength={20}
                autoComplete="off"
                placeholder="Ex. : FR-"
                className="h-12 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base"
              />
              <span className="text-xs text-muted-foreground">
                Facultatif. Les lignes sans code reçoivent FR-001, FR-002… Le numéro de série (s&apos;il existe) évite
                les doublons si vous réimportez le fichier ; sans numéro de série, importez-le une seule fois.
              </span>
            </div>
          </fieldset>
        )}
        <Button type="submit" disabled={enCours} className="h-12 text-base">
          {enCours && !apercu ? "Analyse…" : feuilles ? "Analyser cette feuille" : "Analyser le fichier"}
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

      {demande && edition && (
        <section className="grid gap-4 rounded-lg border bg-card p-4" aria-label="Association des colonnes">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">Associez vos colonnes</h2>
            <p className="text-sm text-muted-foreground">
              Lignes d&apos;en-têtes détectée : ligne {demande.ligne} de votre fichier. Pour chaque information de
              Jalon, choisissez la colonne qui la contient. Les champs facultatifs peuvent rester vides.
            </p>
          </div>
          <ul className="grid gap-3">
            {demande.champs.map((c) => (
              <li key={c.cle} className="grid gap-1.5">
                <label htmlFor={`col-${c.cle}`} className="text-sm font-medium">
                  {c.entete}
                  {c.obligatoire && <span className="text-destructive"> *</span>}
                </label>
                <NativeSelect
                  id={`col-${c.cle}`}
                  className="w-full [&_select]:h-11"
                  value={choix[c.cle] ?? ""}
                  onChange={(e) =>
                    setChoix({ ...choix, [c.cle]: e.target.value === "" ? null : Number(e.target.value) })
                  }
                >
                  <NativeSelectOption value="">{c.obligatoire ? "— choisir —" : "— non utilisée —"}</NativeSelectOption>
                  {demande.entetes.map((entete, i) => (
                    <NativeSelectOption key={i} value={i}>
                      {`Colonne ${i + 1}${entete ? ` — ${entete}` : " (sans titre)"}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">{c.aide}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            disabled={enCours}
            className="h-12 text-base"
            onClick={() => {
              setCorrespondance(choix);
              lancer(analyserImport, choix);
            }}
          >
            {enCours ? "Analyse…" : "Valider l'association et analyser"}
          </Button>
        </section>
      )}

      {apercu && (
        <section className="grid gap-4" aria-label="Aperçu de l'import">
          {demande && !edition && (
            <button type="button" className="w-fit text-sm underline" onClick={() => setEdition(true)}>
              Ajuster l&apos;association des colonnes
            </button>
          )}
          {apercu.importable ? (
            <div className="grid gap-3 rounded-lg border bg-card border-emerald-600/40 p-4">
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
                <li key={l.numero} className="grid gap-1 rounded-lg border bg-card p-3 text-sm">
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
