import Link from "next/link";
import { Plus } from "lucide-react";
import { ChampListe, ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { listerCategories, listerUnivers, type CategorieListe } from "@/lib/requetes/parc";
import { archiverCategorie, archiverUnivers, creerCategorie, creerUnivers, rangerCategories } from "../actions";
import { adresseParc } from "../filtres";

export const metadata = { title: "Univers et catégories — Jalon" };

const nombre = (n: number) => `${n} équipement${n > 1 ? "s" : ""}`;

function Categories({
  categories,
  universId,
  role,
}: {
  categories: CategorieListe[];
  universId: string;
  role: string;
}) {
  if (categories.length === 0)
    return <p className="text-sm text-muted-foreground">Aucune catégorie : ajoutez-en une ci-dessous.</p>;
  return (
    <ul className="grid gap-1.5">
      {categories.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
          <Link
            href={adresseParc({ univers: universId, categorie: c.id })}
            className="underline-offset-2 hover:underline"
          >
            {c.libelle} <span className="text-sm text-muted-foreground">· {nombre(c.nb_equipements)}</span>
          </Link>
          {role === "admin" && c.nb_equipements === 0 && (
            <Formulaire
              action={archiverCategorie.bind(null, c.id)}
              libelle="Archiver"
              variante="outline"
              confirmation={`Archiver la catégorie « ${c.libelle} » ?`}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function PageUnivers() {
  const { univers, categories, role } = await requete(async (tx, u) => ({
    univers: await listerUnivers(tx),
    categories: await listerCategories(tx),
    role: u.role,
  }));
  const peutEcrire = role !== "lecture";
  const aRanger = categories.filter((c) => c.univers_id === null);
  const choixUnivers = univers.map((u) => ({ valeur: u.id, libelle: u.libelle }));

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/equipements" className="text-sm text-muted-foreground underline">
          ← Parc
        </Link>
        <h1 className="text-2xl font-semibold">Univers et catégories</h1>
        <p className="text-sm text-muted-foreground">
          Un univers regroupe le matériel d&apos;un même domaine (biomédical, fauteuils, technique bâtiment…) ; ses
          catégories en précisent la nature (oxymètres, lits, rails…). Chaque univers n&apos;affiche que ses propres
          catégories.
        </p>
      </div>

      {aRanger.length > 0 && (
        <section className="grid gap-3 rounded-lg border border-amber-500/60 bg-card p-4" aria-labelledby="a-ranger">
          <div className="grid gap-1">
            <h2 id="a-ranger" className="text-lg font-semibold">
              Catégories à ranger ({aRanger.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Ces catégories n&apos;appartiennent à aucun univers. Cochez celles d&apos;un même domaine et rangez-les
              ensemble : leurs équipements suivent.
              {univers.length === 0 && " Créez d'abord un univers (en bas de page)."}
            </p>
          </div>
          {peutEcrire && univers.length > 0 ? (
            <Formulaire action={rangerCategories} libelle="Ranger les catégories cochées" variante="secondary">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {aRanger.map((c) => (
                  <li key={c.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-checked:border-primary has-checked:bg-primary/5">
                      <input
                        type="checkbox"
                        name="ids"
                        value={c.id}
                        className="size-5 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="grid">
                        <span className="font-medium">{c.libelle}</span>
                        <span className="text-xs text-muted-foreground">{nombre(c.nb_equipements)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <ChampListe nom="univers_id" libelle="Dans l'univers" vide="Choisir…" options={choixUnivers} />
            </Formulaire>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {aRanger.map((c) => (
                <li key={c.id} className="grid rounded-md border px-3 py-2">
                  <span className="font-medium">{c.libelle}</span>
                  <span className="text-xs text-muted-foreground">{nombre(c.nb_equipements)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {univers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Aucun univers. Créez le premier ci-dessous.
        </p>
      ) : (
        <ul className="grid gap-3">
          {univers.map((u) => {
            const siennes = categories.filter((c) => c.univers_id === u.id);
            return (
              <li key={u.id} className="grid gap-3 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid gap-0.5">
                    <Link
                      href={adresseParc({ univers: u.id })}
                      className="text-lg font-semibold underline-offset-2 hover:underline"
                    >
                      {u.libelle}
                    </Link>
                    {u.description && <span className="text-sm text-muted-foreground">{u.description}</span>}
                    <span className="text-sm text-muted-foreground">{nombre(u.nb_equipements)}</span>
                  </div>
                  {peutEcrire && (
                    <LienBouton href={`/equipements/nouveau?univers=${u.id}`} variante="secondary">
                      <Plus className="size-4" aria-hidden />
                      Ajouter un équipement
                    </LienBouton>
                  )}
                </div>
                <Categories categories={siennes} universId={u.id} role={role} />
                {peutEcrire && (
                  <details className="group rounded-md border border-dashed p-3">
                    <summary className="cursor-pointer text-sm font-medium">Ajouter une catégorie</summary>
                    <Formulaire
                      action={creerCategorie}
                      libelle="Ajouter la catégorie"
                      variante="outline"
                      reinitialiser
                      className="mt-3"
                    >
                      <input type="hidden" name="univers_id" value={u.id} />
                      <ChampTexte
                        nom="libelle"
                        libelle="Nom de la catégorie"
                        required
                        maxLength={120}
                        placeholder="Ex. : Oxymètres"
                      />
                    </Formulaire>
                  </details>
                )}
                {role === "admin" && u.nb_equipements === 0 && siennes.length === 0 && (
                  <Formulaire
                    action={archiverUnivers.bind(null, u.id)}
                    libelle="Archiver l'univers"
                    variante="outline"
                    confirmation="Archiver cet univers ?"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {peutEcrire && (
        <section className="grid gap-3 rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">Nouvel univers</h2>
          <Formulaire action={creerUnivers} libelle="Créer l'univers" reinitialiser>
            <ChampTexte nom="libelle" libelle="Nom" required maxLength={120} placeholder="Ex. : Biomédical" />
            <ChampTexte nom="description" libelle="Description" maxLength={500} />
          </Formulaire>
        </section>
      )}
    </div>
  );
}
