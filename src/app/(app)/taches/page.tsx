import { ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { retardTache } from "@/lib/metier/taches";
import { tachesOuvertes, tachesResolues } from "@/lib/requetes/taches";
import { cn } from "@/lib/utils";
import { creerTache } from "./actions";
import { BoutonResoudre, BoutonRouvrir } from "./bouton-tache";

export const metadata = { title: "Tâches — Jalon" };

export default async function PageTaches() {
  const aujourdhui = aujourdhuiParis();
  const { ouvertes, resolues, peutEcrire } = await requete(async (tx, u) => ({
    ouvertes: await tachesOuvertes(tx),
    resolues: await tachesResolues(tx),
    peutEcrire: u.role !== "lecture",
  }));

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Tâches en cours</h1>

      {peutEcrire && (
        <Formulaire
          action={creerTache}
          libelle="Ajouter la tâche"
          reinitialiser
          className="rounded-lg border bg-card p-4"
        >
          <ChampTexte
            nom="libelle"
            libelle="Nouvelle tâche"
            required
            maxLength={200}
            placeholder="Ex. : commande agrafes reproduction, serrure chambre 12…"
            autoComplete="off"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampTexte nom="echeance" libelle="Pour le (facultatif)" type="date" />
            <ChampTexte nom="notes" libelle="Précision (facultatif)" maxLength={2000} autoComplete="off" />
          </div>
        </Formulaire>
      )}

      <section className="grid gap-2" aria-labelledby="titre-ouvertes">
        <h2 id="titre-ouvertes" className="flex items-baseline gap-2 text-lg font-semibold">
          À faire
          <span className="text-sm font-normal text-muted-foreground">{ouvertes.length}</span>
        </h2>
        {ouvertes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune tâche en cours.
          </p>
        ) : (
          <ul className="grid gap-2">
            {ouvertes.map((t) => {
              const retard = retardTache(t.echeance, aujourdhui);
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-medium">{t.libelle}</span>
                    {t.notes && <span className="text-sm text-muted-foreground">{t.notes}</span>}
                    <span className={cn("text-sm text-muted-foreground", retard && "font-medium text-destructive")}>
                      {t.echeance
                        ? `Pour le ${formaterDate(t.echeance)}${retard ? ` · en retard de ${retard} j` : ""}`
                        : `Ajoutée le ${formaterDate(t.created_at)}`}
                    </span>
                  </span>
                  {peutEcrire && <BoutonResoudre id={t.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {resolues.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Résolues récemment ({resolues.length})
          </summary>
          <ul className="grid gap-2 pt-2">
            {resolues.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-muted-foreground line-through">{t.libelle}</span>
                  <span className="text-sm text-muted-foreground">
                    Résolue le {formaterDate(t.resolue_le)}
                    {t.resolue_par_nom && ` par ${t.resolue_par_nom}`}
                  </span>
                </span>
                {peutEcrire && <BoutonRouvrir id={t.id} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
