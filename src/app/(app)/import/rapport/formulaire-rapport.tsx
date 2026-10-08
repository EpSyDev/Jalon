"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { enregistrerRapport, lireRapportPdf, type Lecture } from "./actions";

const CHAMP = "h-11 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base";

type Reserve = { description: string; gravite: "" | "mineure" | "majeure" | "critique"; echeance_levee: string };
type Bloc = {
  cle: string;
  titre: string;
  details: string[];
  retenu: boolean;
  plan_controle_id: string;
  date_realisation: string;
  resultat: "" | "conforme" | "avec_reserves" | "non_conforme";
  nb_reserves_declare: number;
  commentaire: string;
  reserves: Reserve[];
  /** Plans de l'équipement reconnu, proposés en tête de liste. */
  proposes: string[];
};

const RESULTATS = [
  { valeur: "conforme", libelle: "Conforme" },
  { valeur: "avec_reserves", libelle: "Avec réserves" },
  { valeur: "non_conforme", libelle: "Non conforme" },
] as const;

/** Un bloc de saisie par fiche du rapport (ou un bloc vide si aucune fiche n'est reconnue). */
function blocsDepuis(l: Extract<Lecture, { rapport: unknown }>): Bloc[] {
  const date = l.rapport.date_intervention ?? "";
  if (l.rapport.fiches.length === 0) {
    return [
      {
        cle: "manuel",
        titre: "Contrôle concerné",
        details: [],
        retenu: true,
        plan_controle_id: "",
        date_realisation: date,
        resultat: "",
        nb_reserves_declare: 0,
        commentaire: "",
        reserves: [],
        proposes: [],
      },
    ];
  }
  return l.rapport.fiches.map((f, i) => {
    const r = l.rapprochements[i];
    return {
      cle: `fiche-${f.numero}`,
      titre: `Fiche n° ${f.numero}${f.localisation ? ` — ${f.localisation}` : ""}`,
      details: [
        [f.marque, f.type].filter(Boolean).join(" "),
        f.numero_serie ? `n° de série ${f.numero_serie}` : "",
        f.avis ? `avis général : ${f.avis}` : "",
        r.equipement
          ? `équipement reconnu : ${r.equipement.code} — ${r.equipement.libelle}${r.plans.length ? "" : " (aucun plan de contrôle : créez-le d'abord)"}`
          : "aucun équipement du parc avec ce n° de série",
      ].filter(Boolean),
      retenu: true,
      plan_controle_id: r.plans.length === 1 ? r.plans[0].id : "",
      date_realisation: date,
      resultat: f.resultat_propose ?? "",
      nb_reserves_declare: 0,
      commentaire: f.avis ? `Avis général : ${f.avis}` : "",
      reserves: [],
      proposes: r.plans.map((p) => p.id),
    };
  });
}

export function FormulaireRapport() {
  const [lecture, setLecture] = useState<Extract<Lecture, { rapport: unknown }> | null>(null);
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<{ ton: "erreur" | "succes"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const modifier = (cle: string, changement: Partial<Bloc>) =>
    setBlocs((bs) => bs.map((b) => (b.cle === cle ? { ...b, ...changement } : b)));

  function lire(formData: FormData) {
    demarrer(async () => {
      const r = await lireRapportPdf(formData);
      if (r.erreur !== undefined) {
        setLecture(null);
        setMessage({ ton: "erreur", texte: r.erreur });
        return;
      }
      setMessage(null);
      setLecture(r);
      setBlocs(blocsDepuis(r));
      setReference([r.rapport.reference, r.fichier].filter(Boolean).join(" — ").slice(0, 500));
    });
  }

  function enregistrer() {
    const retenus = blocs.filter((b) => b.retenu);
    demarrer(async () => {
      const r = await enregistrerRapport({
        reference_rapport: reference,
        controles: retenus.map((b) => ({
          plan_controle_id: b.plan_controle_id,
          date_realisation: b.date_realisation,
          resultat: b.resultat as "conforme",
          nb_reserves_declare: b.nb_reserves_declare,
          commentaire: b.commentaire,
          reserves: b.reserves.map((x) => ({ ...x, gravite: x.gravite === "" ? null : x.gravite })),
        })),
      });
      if ("erreur" in r) setMessage({ ton: "erreur", texte: r.erreur });
      else {
        setMessage({ ton: "succes", texte: r.message });
        setLecture(null);
        setBlocs([]);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <form action={lire} className="grid gap-4 rounded-lg border bg-card p-4">
        <div className="grid gap-2">
          <Label htmlFor="fichier">Rapport PDF (10 Mo maximum)</Label>
          <input
            id="fichier"
            name="fichier"
            type="file"
            required
            accept=".pdf,application/pdf"
            className="w-full min-w-0 rounded-lg border p-3 text-base file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5"
          />
        </div>
        <Button type="submit" disabled={enCours} className="h-12 text-base">
          {enCours && !lecture ? "Lecture…" : "Lire le rapport"}
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

      {lecture && (
        <section className="grid gap-4" aria-label="Contrôles à enregistrer">
          <div className="grid gap-1 rounded-lg border bg-card p-4 text-sm">
            <p className="font-medium">{lecture.rapport.objet ?? "Rapport"}</p>
            <p className="text-muted-foreground">
              {[
                lecture.rapport.organisme,
                lecture.rapport.date_intervention &&
                  `intervention du ${lecture.rapport.date_intervention.split("-").reverse().join("/")}`,
                lecture.rapport.nb_fiches_annonce !== null &&
                  `${lecture.rapport.nb_fiches_annonce} fiche(s) annoncée(s)`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {lecture.rapport.alertes.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-amber-800 dark:text-amber-300">
                {lecture.rapport.alertes.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reference">Référence du rapport</Label>
            <input
              id="reference"
              value={reference}
              maxLength={500}
              onChange={(e) => setReference(e.target.value)}
              className={CHAMP}
            />
          </div>

          {blocs.map((b) => (
            <fieldset key={b.cle} className="grid gap-3 rounded-lg border bg-card p-4">
              <legend className="px-2 font-medium">{b.titre}</legend>
              {b.details.length > 0 && (
                <ul className="text-sm text-muted-foreground">
                  {b.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {blocs.length > 1 && (
                <label className="flex min-h-10 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={b.retenu}
                    onChange={(e) => modifier(b.cle, { retenu: e.target.checked })}
                  />
                  Enregistrer ce contrôle
                </label>
              )}
              {b.retenu && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${b.cle}-plan`}>Contrôle concerné</Label>
                    <NativeSelect
                      id={`${b.cle}-plan`}
                      value={b.plan_controle_id}
                      onChange={(e) => modifier(b.cle, { plan_controle_id: e.target.value })}
                      className="w-full [&_select]:h-11"
                    >
                      <NativeSelectOption value="">— choisir —</NativeSelectOption>
                      {lecture.plans
                        .filter((p) => b.proposes.includes(p.id))
                        .map((p) => (
                          <NativeSelectOption key={`p-${p.id}`} value={p.id}>
                            {`★ ${p.libelle}`}
                          </NativeSelectOption>
                        ))}
                      {lecture.plans
                        .filter((p) => !b.proposes.includes(p.id))
                        .map((p) => (
                          <NativeSelectOption key={p.id} value={p.id}>
                            {p.libelle}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${b.cle}-date`}>Date de réalisation</Label>
                      <input
                        id={`${b.cle}-date`}
                        type="date"
                        value={b.date_realisation}
                        onChange={(e) => modifier(b.cle, { date_realisation: e.target.value })}
                        className={CHAMP}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${b.cle}-resultat`}>Résultat</Label>
                      <NativeSelect
                        id={`${b.cle}-resultat`}
                        value={b.resultat}
                        onChange={(e) => modifier(b.cle, { resultat: e.target.value as Bloc["resultat"] })}
                        className="w-full [&_select]:h-11"
                      >
                        <NativeSelectOption value="">— choisir —</NativeSelectOption>
                        {RESULTATS.map((r) => (
                          <NativeSelectOption key={r.valeur} value={r.valeur}>
                            {r.libelle}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${b.cle}-nb`}>Réserves annoncées</Label>
                      <input
                        id={`${b.cle}-nb`}
                        type="number"
                        min={0}
                        max={500}
                        value={b.nb_reserves_declare}
                        onChange={(e) => modifier(b.cle, { nb_reserves_declare: Number(e.target.value) || 0 })}
                        className={CHAMP}
                      />
                    </div>
                  </div>
                  {b.nb_reserves_declare > 0 && b.reserves.length !== b.nb_reserves_declare && (
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {`Réserves annoncées : ${b.nb_reserves_declare}, détaillées : ${b.reserves.length}.`}
                      {b.reserves.length < b.nb_reserves_declare &&
                        " Les réserves non détaillées seront créées « à détailler »."}
                    </p>
                  )}
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${b.cle}-commentaire`}>Commentaire</Label>
                    <textarea
                      id={`${b.cle}-commentaire`}
                      value={b.commentaire}
                      maxLength={2000}
                      rows={2}
                      onChange={(e) => modifier(b.cle, { commentaire: e.target.value })}
                      className="w-full min-w-0 rounded-lg border bg-transparent p-3 text-base"
                    />
                  </div>
                  <div className="grid gap-2">
                    {b.reserves.map((r, i) => {
                      const changer = (c: Partial<Reserve>) =>
                        modifier(b.cle, { reserves: b.reserves.map((x, j) => (j === i ? { ...x, ...c } : x)) });
                      return (
                        <div key={i} className="grid gap-2 rounded-lg border border-dashed p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{`Réserve ${i + 1}`}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => modifier(b.cle, { reserves: b.reserves.filter((_, j) => j !== i) })}
                            >
                              <Trash2 className="size-4" aria-hidden />
                              Retirer
                            </Button>
                          </div>
                          <textarea
                            aria-label={`Description de la réserve ${i + 1}`}
                            value={r.description}
                            maxLength={2000}
                            rows={2}
                            onChange={(e) => changer({ description: e.target.value })}
                            className="w-full min-w-0 rounded-lg border bg-transparent p-3 text-base"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <NativeSelect
                              aria-label={`Gravité de la réserve ${i + 1}`}
                              value={r.gravite}
                              onChange={(e) => changer({ gravite: e.target.value as Reserve["gravite"] })}
                              className="w-full [&_select]:h-11"
                            >
                              <NativeSelectOption value="">Gravité non précisée</NativeSelectOption>
                              <NativeSelectOption value="mineure">Mineure</NativeSelectOption>
                              <NativeSelectOption value="majeure">Majeure</NativeSelectOption>
                              <NativeSelectOption value="critique">Critique</NativeSelectOption>
                            </NativeSelect>
                            <input
                              type="date"
                              aria-label={`Échéance de levée de la réserve ${i + 1}`}
                              value={r.echeance_levee}
                              onChange={(e) => changer({ echeance_levee: e.target.value })}
                              className={CHAMP}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit"
                      onClick={() =>
                        modifier(b.cle, {
                          reserves: [...b.reserves, { description: "", gravite: "", echeance_levee: "" }],
                        })
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      Ajouter une réserve
                    </Button>
                  </div>
                </>
              )}
            </fieldset>
          ))}

          <Button onClick={enregistrer} disabled={enCours} className="h-12 text-base">
            {enCours ? "Enregistrement…" : "Enregistrer les contrôles"}
          </Button>
        </section>
      )}
    </div>
  );
}
