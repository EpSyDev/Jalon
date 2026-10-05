import Link from "next/link";
import { ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { listerLocalisations } from "@/lib/requetes/parc";
import { archiverLocalisation, creerLocalisation } from "../actions";

export const metadata = { title: "Localisations — Jalon" };

export default async function PageLocalisations() {
  const { localisations, role } = await requete(async (tx, u) => ({
    localisations: await listerLocalisations(tx),
    role: u.role,
  }));

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/equipements" className="text-sm text-muted-foreground underline">
          ← Parc matériel
        </Link>
        <h1 className="text-2xl font-semibold">Localisations</h1>
      </div>

      {role !== "lecture" && (
        <section className="grid gap-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Nouvelle localisation</h2>
          <Formulaire action={creerLocalisation} libelle="Ajouter" reinitialiser>
            <div className="grid gap-4 sm:grid-cols-3">
              <ChampTexte nom="batiment" libelle="Bâtiment" required maxLength={120} />
              <ChampTexte nom="niveau" libelle="Niveau" maxLength={60} placeholder="RDC, R+1…" />
              <ChampTexte nom="local" libelle="Local" maxLength={120} />
            </div>
          </Formulaire>
        </section>
      )}

      {localisations.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucune localisation.</p>
      ) : (
        <ul className="grid gap-2">
          {localisations.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="font-medium">{l.libelle_complet}</span>
                <span className="block text-sm text-muted-foreground">
                  {l.nb_equipements} équipement{l.nb_equipements > 1 ? "s" : ""}
                </span>
              </span>
              {role === "admin" && l.nb_equipements === 0 && (
                <Formulaire
                  action={archiverLocalisation.bind(null, l.id)}
                  libelle="Archiver"
                  variante="outline"
                  confirmation="Archiver cette localisation ?"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
