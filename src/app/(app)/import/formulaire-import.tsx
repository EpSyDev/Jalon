"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Correspondance, DemandeCorrespondance } from "@/lib/metier/import";
import { analyserImport, importer, type Apercu, type DemandeFeuille, type ReponseImport } from "./actions";

const TYPES = [
  { valeur: "equipements", libelle: "Équipements (fauteuils, matériel biomédical, etc.)" },
  { valeur: "controles", libelle: "Contrôles (annexe A)" },
] as const;

const STATUTS = {
  creation: { libelle: "À créer", icone: CircleCheck, classe: "text-emerald-700 dark:text-emerald-400" },
  ignoree: { libelle: "Ignorée", icone: CircleMinus, classe: "text-muted-foreground" },
  erreur: { libelle: "Erreur", icone: CircleAlert, classe: "text-destructive" },
} as const;

const CHAMP = "h-12 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base";

// --- Association mémorisée (ce navigateur) pour un modèle de feuille : mêmes titres de colonnes ----------------

type Association = { correspondance: Correspondance; exclues: number[] };
/** Association par feuille ; clé "" pour un fichier sans feuille à choisir (CSV, classeur à une feuille). */
type Associations = Record<string, Association>;

function cleMemoire(type: string, entetes: string[]): string {
  const s = `${type}|${entetes.join("|")}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `jalon:import:${(h >>> 0).toString(36)}`;
}

function lireMemoire(cle: string): Association | null {
  try {
    const m = JSON.parse(localStorage.getItem(cle) ?? "null");
    return m && typeof m.correspondance === "object" && Array.isArray(m.exclues) ? m : null;
  } catch {
    return null;
  }
}

function ecrireMemoire(cle: string, m: Association) {
  try {
    localStorage.setItem(cle, JSON.stringify(m));
  } catch {
    // Stockage indisponible (navigation privée) : l'association sera simplement reproposée.
  }
}

const associationDe = (d: DemandeCorrespondance): Association => ({
  correspondance: Object.fromEntries(d.champs.map((c) => [c.cle, c.choix])),
  exclues: d.exclues,
});
const memeAssociation = (a: Association, b: Association) =>
  JSON.stringify(Object.entries(a.correspondance).sort()) === JSON.stringify(Object.entries(b.correspondance).sort()) &&
  JSON.stringify([...a.exclues].sort()) === JSON.stringify([...b.exclues].sort());
const cleFeuille = (d: DemandeFeuille) => d.feuille ?? "";

export function FormulaireImport({ univers }: { univers: { id: string; libelle: string }[] }) {
  const [type, setType] = useState<"controles" | "equipements">("equipements");
  // Classeur à plusieurs feuilles : l'utilisateur coche celles à importer.
  const [feuilles, setFeuilles] = useState<string[] | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [message, setMessage] = useState<{ ton: "erreur" | "succes" | "info"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [filtreErreurs, setFiltreErreurs] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  // Association des colonnes, feuille par feuille : proposée, ajustable, mémorisée par modèle de feuille.
  const [demandes, setDemandes] = useState<DemandeFeuille[]>([]);
  const [associations, setAssociations] = useState<Associations>({});
  const [edition, setEdition] = useState<{ cle: string; choix: Correspondance; exclues: number[] } | null>(null);

  function reinitialiser() {
    setApercu(null);
    setDemandes([]);
    setAssociations({});
    setEdition(null);
  }

  function lancer(action: typeof analyserImport, assoc: Associations = associations) {
    if (!formulaire.current) return;
    const typeFichier = String(new FormData(formulaire.current).get("type"));
    const envoyer = (a: Associations) => {
      const d = new FormData(formulaire.current!);
      d.set("associations", JSON.stringify(a));
      return action(d);
    };
    demarrer(async () => {
      let r: ReponseImport = await envoyer(assoc);
      let reprise = false;
      // Feuilles analysées sans association choisie : reprendre celle mémorisée pour ce modèle, si elle diffère.
      if (action === analyserImport && r.demandes?.length) {
        const complement: Associations = {};
        for (const d of r.demandes) {
          if (assoc[cleFeuille(d)]) continue;
          const memoire = lireMemoire(cleMemoire(typeFichier, d.demande.entetes));
          if (memoire && !memeAssociation(memoire, associationDe(d.demande))) complement[cleFeuille(d)] = memoire;
        }
        if (Object.keys(complement).length) {
          assoc = { ...assoc, ...complement };
          setAssociations(assoc);
          r = await envoyer(assoc);
          reprise = true;
        }
      }
      if (r.demandes) setDemandes(r.demandes);
      if (r.erreur !== undefined) {
        setApercu(null);
        if (r.feuilles) setFeuilles(r.feuilles);
        setMessage({ ton: "erreur", texte: r.erreur });
        // Colonne obligatoire introuvable : ouvrir l'association de la première feuille en cause.
        const enCause = r.demandes?.find((d) => r.erreur!.includes(`« ${d.feuille} »`)) ?? r.demandes?.[0];
        if (enCause)
          setEdition({
            cle: cleFeuille(enCause),
            ...associationDe(enCause.demande),
            choix: associationDe(enCause.demande).correspondance,
          });
      } else if (r.importe) {
        for (const d of demandes) ecrireMemoire(cleMemoire(typeFichier, d.demande.entetes), associationDe(d.demande));
        setMessage({ ton: "succes", texte: r.importe });
        reinitialiser();
        setFeuilles(null);
        setMaintenance(false);
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
        setEdition(null);
        setApercu(r.apercu);
        setFiltreErreurs(!r.apercu.importable);
      }
    });
  }

  const nbErreurs = apercu?.lignes.filter((l) => l.statut === "erreur").length ?? 0;
  const lignes = apercu ? (filtreErreurs ? apercu.lignes.filter((l) => l.statut === "erreur") : apercu.lignes) : [];
  const demandeEditee = edition ? demandes.find((d) => cleFeuille(d) === edition.cle) : undefined;
  const associees = new Set(Object.values(edition?.choix ?? {}).filter((i): i is number => i !== null));
  const plusieursFeuilles = demandes.length > 1 || lignes.some((l) => l.feuille);

  return (
    <div className="grid gap-6">
      <form
        ref={formulaire}
        className="grid gap-4 rounded-lg border bg-card p-4"
        onChange={(e) => {
          const cible = e.target as unknown as HTMLInputElement;
          if (cible.name === "type") setType(cible.value as "controles" | "equipements");
          if (cible.name === "maintenance") setMaintenance(cible.checked);
          setApercu(null);
          // Options : l'association reste valable. Autre fichier ou autres feuilles : elle repart de zéro.
          if (!["type", "fichier", "feuille"].includes(cible.name)) return;
          if (cible.name !== "feuille") setFeuilles(null);
          reinitialiser();
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
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">Feuilles à importer (une ou plusieurs)</legend>
            <p className="mb-1 text-xs text-muted-foreground">
              Les feuilles cochées sont importées ensemble, chacune avec ses propres colonnes.
            </p>
            {feuilles.map((f, i) => (
              <label key={f} className="flex min-h-10 items-center gap-3 text-sm">
                <input type="checkbox" name="feuille" value={f} defaultChecked={i === 0} className="size-5 shrink-0" />
                {f}
              </label>
            ))}
          </fieldset>
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
                className={CHAMP}
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
                className={CHAMP}
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
        {type === "equipements" && (
          <fieldset className="grid gap-4 rounded-lg border border-dashed p-4">
            <legend className="px-2 text-sm font-medium">Maintenances du fichier</legend>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" name="maintenance" className="mt-0.5 size-5 shrink-0" />
              <span>
                Reprendre les maintenances datées (« DATE MP 2024 », « Dernière maintenance », « Dernier étalonnage »…)
                en contrôles : un plan par équipement, son historique et sa prochaine échéance.
              </span>
            </label>
            {maintenance && (
              <>
                <p className="text-xs text-muted-foreground">
                  Une maintenance dont la colonne « vigilance » ou « réserves » est vide ou dit « RAS » est enregistrée
                  conforme ; sinon avec réserves. Seules les vigilances de la maintenance la plus récente deviennent des
                  réserves ouvertes, les plus anciennes restent dans le commentaire du contrôle. La périodicité est lue
                  sur la ligne (« 1 fois / an », « 2 fois / an »…), sinon celle ci-dessous.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="maint_libelle">Libellé du contrôle</Label>
                    <input
                      id="maint_libelle"
                      name="maint_libelle"
                      maxLength={200}
                      defaultValue="Maintenance préventive"
                      className={CHAMP}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maint_famille">Famille du contrôle</Label>
                    <input
                      id="maint_famille"
                      name="maint_famille"
                      maxLength={120}
                      defaultValue="Maintenance"
                      className={CHAMP}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maint_caractere">Caractère</Label>
                    <NativeSelect
                      id="maint_caractere"
                      name="maint_caractere"
                      defaultValue="interne"
                      className="w-full [&_select]:h-12"
                    >
                      <NativeSelectOption value="interne">Interne</NativeSelectOption>
                      <NativeSelectOption value="obligatoire">Obligatoire</NativeSelectOption>
                      <NativeSelectOption value="reglementaire">Réglementaire</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maint_periodicite">Périodicité par défaut (mois)</Label>
                    <input
                      id="maint_periodicite"
                      name="maint_periodicite"
                      type="number"
                      min={1}
                      max={120}
                      defaultValue={12}
                      className={CHAMP}
                    />
                  </div>
                </div>
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input type="checkbox" name="maint_conforme" className="mt-0.5 size-5 shrink-0" />
                  <span>
                    Le fichier n&apos;a pas de colonne « vigilance » ou « réserves » pour certaines dates (ex. suivi
                    biomédical) : je confirme que ces maintenances ont été faites sans réserve. Sinon, ces dates restent
                    dans les notes.
                  </span>
                </label>
              </>
            )}
          </fieldset>
        )}
        <Button type="submit" disabled={enCours} className="h-12 text-base">
          {enCours && !apercu ? "Analyse…" : feuilles ? "Analyser les feuilles cochées" : "Analyser le fichier"}
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

      {demandes.length > 0 && !edition && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {demandes.map((d) => (
            <button
              key={cleFeuille(d)}
              type="button"
              className="w-fit text-sm underline"
              onClick={() => {
                const a = associations[cleFeuille(d)] ?? associationDe(d.demande);
                setEdition({ cle: cleFeuille(d), choix: a.correspondance, exclues: a.exclues });
              }}
            >
              {d.feuille ? `Ajuster les colonnes de « ${d.feuille} »` : "Ajuster l'association des colonnes"}
            </button>
          ))}
        </div>
      )}

      {edition && demandeEditee && (
        <section className="grid gap-4 rounded-lg border bg-card p-4" aria-label="Association des colonnes">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">
              Associez vos colonnes{demandeEditee.feuille ? ` : « ${demandeEditee.feuille} »` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ligne d&apos;en-têtes détectée : ligne {demandeEditee.demande.ligne}. Pour chaque information de Jalon,
              choisissez la colonne qui la contient. Les champs facultatifs peuvent rester vides. L&apos;association est
              retenue pour les prochains fichiers du même modèle.
            </p>
          </div>
          <ul className="grid gap-3">
            {demandeEditee.demande.champs.map((c) => (
              <li key={c.cle} className="grid gap-1.5">
                <label htmlFor={`col-${c.cle}`} className="text-sm font-medium">
                  {c.entete}
                  {c.obligatoire && <span className="text-destructive"> *</span>}
                </label>
                <NativeSelect
                  id={`col-${c.cle}`}
                  className="w-full [&_select]:h-11"
                  value={edition.choix[c.cle] ?? ""}
                  onChange={(e) =>
                    setEdition({
                      ...edition,
                      choix: { ...edition.choix, [c.cle]: e.target.value === "" ? null : Number(e.target.value) },
                    })
                  }
                >
                  <NativeSelectOption value="">{c.obligatoire ? "— choisir —" : "— non utilisée —"}</NativeSelectOption>
                  {demandeEditee.demande.entetes.map((entete, i) => (
                    <NativeSelectOption key={i} value={i}>
                      {`Colonne ${i + 1}${entete ? ` — ${entete}` : " (sans titre)"}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">{c.aide}</span>
              </li>
            ))}
          </ul>
          {type === "equipements" && demandeEditee.demande.entetes.some((_, i) => !associees.has(i)) && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Autres colonnes reprises dans les notes</legend>
              <p className="text-xs text-muted-foreground">
                Décochez celles qui n&apos;apportent rien : les notes d&apos;un équipement sont limitées à 2 000
                caractères. Avec la reprise des maintenances, les colonnes de chaque maintenance vont dans son contrôle
                et non dans les notes.
              </p>
              {demandeEditee.demande.entetes.map((entete, i) =>
                associees.has(i) ? null : (
                  <label key={i} className="flex min-h-10 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0"
                      checked={!edition.exclues.includes(i)}
                      onChange={(e) =>
                        setEdition({
                          ...edition,
                          exclues: e.target.checked ? edition.exclues.filter((x) => x !== i) : [...edition.exclues, i],
                        })
                      }
                    />
                    {`Colonne ${i + 1}${entete ? ` — ${entete}` : " (sans titre)"}`}
                  </label>
                ),
              )}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={enCours}
              className="h-12 flex-1 text-base"
              onClick={() => {
                const suivantes = {
                  ...associations,
                  [edition.cle]: { correspondance: edition.choix, exclues: edition.exclues },
                };
                setAssociations(suivantes);
                lancer(analyserImport, suivantes);
              }}
            >
              {enCours ? "Analyse…" : "Valider l'association et analyser"}
            </Button>
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setEdition(null)}>
              Fermer
            </Button>
          </div>
        </section>
      )}

      {apercu && (
        <section className="grid gap-4" aria-label="Aperçu de l'import">
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
                <li key={`${l.feuille ?? ""}-${l.numero}`} className="grid gap-1 rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <s.icone className={cn("mt-0.5 size-4 shrink-0", s.classe)} aria-hidden />
                    <span className="text-muted-foreground">
                      {plusieursFeuilles && l.feuille ? `${l.feuille} · ` : ""}Ligne {l.numero}
                    </span>
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
