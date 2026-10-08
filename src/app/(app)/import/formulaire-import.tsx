"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Correspondance, DemandeCorrespondance } from "@/lib/metier/import";
import { analyserImport, importer, type Apercu, type ReponseImport } from "./actions";

const TYPES = [
  { valeur: "equipements", libelle: "Équipements (fauteuils, matériel biomédical, etc.)" },
  { valeur: "controles", libelle: "Contrôles (annexe A)" },
] as const;

const STATUTS = {
  creation: { libelle: "À créer", icone: CircleCheck, classe: "text-emerald-700 dark:text-emerald-400" },
  ignoree: { libelle: "Ignorée", icone: CircleMinus, classe: "text-muted-foreground" },
  erreur: { libelle: "Erreur", icone: CircleAlert, classe: "text-destructive" },
} as const;

// --- Association mémorisée (ce navigateur) pour un modèle de fichier : mêmes titres de colonnes ----------------

type Memoire = { correspondance: Correspondance; exclues: number[] };

function cleMemoire(type: string, entetes: string[]): string {
  const s = `${type}|${entetes.join("|")}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `jalon:import:${(h >>> 0).toString(36)}`;
}

function lireMemoire(cle: string): Memoire | null {
  try {
    const m = JSON.parse(localStorage.getItem(cle) ?? "null");
    return m && typeof m.correspondance === "object" && Array.isArray(m.exclues) ? m : null;
  } catch {
    return null;
  }
}

function ecrireMemoire(cle: string, m: Memoire) {
  try {
    localStorage.setItem(cle, JSON.stringify(m));
  } catch {
    // Stockage indisponible (navigation privée) : l'association sera simplement reproposée.
  }
}

const choixDe = (d: DemandeCorrespondance): Correspondance => Object.fromEntries(d.champs.map((c) => [c.cle, c.choix]));
const memeAssociation = (a: Memoire, b: Memoire) =>
  JSON.stringify(Object.entries(a.correspondance).sort()) === JSON.stringify(Object.entries(b.correspondance).sort()) &&
  JSON.stringify([...a.exclues].sort()) === JSON.stringify([...b.exclues].sort());

export function FormulaireImport({ univers }: { univers: { id: string; libelle: string }[] }) {
  const [type, setType] = useState<"controles" | "equipements">("equipements");
  // Classeur à plusieurs feuilles : l'utilisateur choisit celle à importer.
  const [feuilles, setFeuilles] = useState<string[] | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [message, setMessage] = useState<{ ton: "erreur" | "succes" | "info"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [filtreErreurs, setFiltreErreurs] = useState(false);
  // Association des colonnes : proposée par l'outil, ajustable par l'utilisateur, mémorisée par modèle de fichier.
  const [demande, setDemande] = useState<DemandeCorrespondance | null>(null);
  const [choix, setChoix] = useState<Correspondance>({});
  const [exclues, setExclues] = useState<number[]>([]);
  const [correspondance, setCorrespondance] = useState<Correspondance | null>(null);
  const [edition, setEdition] = useState(false);

  function lancer(
    action: typeof analyserImport,
    assoc: Correspondance | null = correspondance,
    excl: number[] = exclues,
  ) {
    if (!formulaire.current) return;
    const donnees = new FormData(formulaire.current);
    const typeFichier = String(donnees.get("type"));
    const envoyer = (a: Correspondance | null, e: number[]) => {
      const d = new FormData(formulaire.current!);
      if (a) d.set("correspondance", JSON.stringify(a));
      d.set("exclues", JSON.stringify(e));
      return action(d);
    };
    demarrer(async () => {
      let r: ReponseImport = await envoyer(assoc, excl);
      let reprise = false;
      // Premier passage sur un fichier : reprendre l'association mémorisée pour ce modèle, si elle diffère.
      if (!assoc && action === analyserImport && r.demande) {
        const memoire = lireMemoire(cleMemoire(typeFichier, r.demande.entetes));
        if (memoire && !memeAssociation(memoire, { correspondance: choixDe(r.demande), exclues: r.demande.exclues })) {
          r = await envoyer(memoire.correspondance, memoire.exclues);
          setCorrespondance(memoire.correspondance);
          reprise = true;
        }
      }
      if (r.demande) {
        setDemande(r.demande);
        setChoix(choixDe(r.demande));
        setExclues(r.demande.exclues);
      }
      if (r.erreur !== undefined) {
        setApercu(null);
        if (r.demande) {
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
        if (demande) {
          ecrireMemoire(cleMemoire(typeFichier, demande.entetes), {
            correspondance: choixDe(demande),
            exclues: demande.exclues,
          });
        }
        setMessage({ ton: "succes", texte: r.importe });
        setApercu(null);
        setDemande(null);
        setCorrespondance(null);
        setExclues([]);
        formulaire.current?.reset();
      } else if (r.apercu) {
        setMessage(
          reprise
            ? {
                ton: "info",
                texte: "Association des colonnes reprise d'un import précédent du même modèle de fichier.",
              }
            : null,
        );
        setEdition(false);
        setApercu(r.apercu);
        setFiltreErreurs(!r.apercu.importable);
      }
    });
  }

  const nbErreurs = apercu?.lignes.filter((l) => l.statut === "erreur").length ?? 0;
  const lignes = apercu ? (filtreErreurs ? apercu.lignes.filter((l) => l.statut === "erreur") : apercu.lignes) : [];
  const associees = new Set(Object.values(choix).filter((i): i is number => i !== null));

  return (
    <div className="grid gap-6">
      <form
        ref={formulaire}
        className="grid gap-4 rounded-lg border bg-card p-4"
        onChange={(e) => {
          const cible = e.target as unknown as HTMLInputElement;
          if (cible.name === "type") setType(cible.value as "controles" | "equipements");
          setApercu(null);
          // Options (préfixe, bâtiment…) : l'association reste valable. Autre fichier ou feuille : elle repart de zéro.
          if (!["type", "fichier", "feuille"].includes(cible.name)) return;
          if (cible.name !== "feuille") setFeuilles(null);
          setDemande(null);
          setCorrespondance(null);
          setExclues([]);
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
                Facultatif. Les lignes sans code, ou dont le code est « ABSENT », non valide ou en double, reçoivent
                FR-001, FR-002… (le code d&apos;origine est gardé dans les notes). Le numéro de série (s&apos;il existe)
                évite les doublons si vous réimportez le fichier ; sans numéro de série, importez-le une seule fois.
              </span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="batiment_defaut">Bâtiment de tous ces équipements</Label>
              <input
                id="batiment_defaut"
                name="batiment_defaut"
                maxLength={120}
                autoComplete="off"
                placeholder="Ex. : Bâtiment principal"
                className="h-12 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base"
              />
              <span className="text-xs text-muted-foreground">
                Facultatif. Utilisé quand la colonne « Bâtiment » est vide ou absente : nécessaire pour ranger un étage
                ou une chambre.
              </span>
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" name="titres_famille" className="mt-0.5 size-5 shrink-0" />
              <span>
                Les lignes d&apos;une seule cellule (ex. « AUTOTENSIOMETRE ») donnent la famille des lignes qui suivent.
              </span>
            </label>
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
            message.ton === "erreur" && "bg-destructive/10 text-destructive",
            message.ton === "succes" && "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
            message.ton === "info" && "bg-muted text-foreground",
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
              Ligne d&apos;en-têtes détectée : ligne {demande.ligne} de votre fichier. Pour chaque information de Jalon,
              choisissez la colonne qui la contient. Les champs facultatifs peuvent rester vides. L&apos;association est
              retenue pour les prochains fichiers du même modèle.
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
          {type === "equipements" && demande.entetes.some((_, i) => !associees.has(i)) && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Autres colonnes reprises dans les notes</legend>
              <p className="text-xs text-muted-foreground">
                Décochez celles qui n&apos;apportent rien : les notes d&apos;un équipement sont limitées à 2 000
                caractères.
              </p>
              {demande.entetes.map((entete, i) =>
                associees.has(i) ? null : (
                  <label key={i} className="flex min-h-10 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0"
                      checked={!exclues.includes(i)}
                      onChange={(e) => setExclues(e.target.checked ? exclues.filter((x) => x !== i) : [...exclues, i])}
                    />
                    {`Colonne ${i + 1}${entete ? ` — ${entete}` : " (sans titre)"}`}
                  </label>
                ),
              )}
            </fieldset>
          )}
          <Button
            type="button"
            disabled={enCours}
            className="h-12 text-base"
            onClick={() => {
              setCorrespondance(choix);
              lancer(analyserImport, choix, exclues);
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
                : "Rien de nouveau à importer : toutes les lignes sont déjà présentes ou ignorées."}
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
