import Link from "next/link";
import { ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { LIBELLES_CARACTERE } from "@/lib/format";
import { listerFamilles, listerTypes } from "@/lib/requetes/controles";
import { creerFamille, creerType } from "../actions";
import { ChampsType } from "./champs-type";

export const metadata = { title: "Types de contrôle — Jalon" };

export default async function PageTypes() {
  const { types, familles, peutEcrire } = await requete(async (tx, u) => {
    const [types, familles] = await Promise.all([listerTypes(tx), listerFamilles(tx)]);
    return { types, familles, peutEcrire: u.role !== "lecture" };
  });

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/controles" className="text-sm text-muted-foreground underline">
          ← Contrôles
        </Link>
        <h1 className="text-2xl font-semibold">Types de contrôle</h1>
        <p className="text-sm text-muted-foreground">
          Un type définit la nature et la périodicité d&apos;un contrôle. Un plan l&apos;applique à un équipement ou un
          périmètre.
        </p>
      </div>

      {types.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucun type de contrôle.</p>
      ) : (
        <ul className="grid gap-2">
          {types.map((t) => {
            const contenu = (
              <>
                <span className="font-medium">{t.libelle}</span>
                <span className="text-sm text-muted-foreground">
                  {t.famille_libelle} · {LIBELLES_CARACTERE[t.caractere]} · tous les {t.periodicite_mois} mois ·{" "}
                  {t.nb_plans} plan{t.nb_plans > 1 ? "s" : ""}
                </span>
                {t.reference_texte && <span className="text-sm">{t.reference_texte}</span>}
              </>
            );
            return (
              <li key={t.id}>
                {peutEcrire ? (
                  <Link
                    href={`/controles/types/${t.id}`}
                    className="grid gap-1 rounded-lg border p-4 hover:bg-muted/50"
                  >
                    {contenu}
                  </Link>
                ) : (
                  <div className="grid gap-1 rounded-lg border bg-card p-4">{contenu}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {peutEcrire && (
        <>
          <section className="grid gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Nouveau type</h2>
            {familles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Créez d&apos;abord une famille ci-dessous.</p>
            ) : (
              <Formulaire action={creerType} libelle="Créer le type">
                <ChampsType familles={familles} />
              </Formulaire>
            )}
          </section>

          <section className="grid gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Familles</h2>
            <p className="text-sm text-muted-foreground">
              {familles.length > 0 ? familles.map((f) => f.libelle).join(" · ") : "Aucune famille."}
            </p>
            <Formulaire action={creerFamille} libelle="Ajouter la famille" variante="outline" reinitialiser>
              <ChampTexte
                nom="libelle"
                libelle="Nouvelle famille"
                required
                maxLength={120}
                placeholder="Ex. : Électricité"
              />
            </Formulaire>
          </section>
        </>
      )}
    </div>
  );
}
