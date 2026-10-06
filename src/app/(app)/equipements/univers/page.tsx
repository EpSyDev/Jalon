import Link from "next/link";
import { Plus } from "lucide-react";
import { ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { listerUnivers } from "@/lib/requetes/parc";
import { archiverUnivers, creerUnivers } from "../actions";

export const metadata = { title: "Univers du parc — Jalon" };

export default async function PageUnivers() {
  const { univers, role } = await requete(async (tx, u) => ({ univers: await listerUnivers(tx), role: u.role }));

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/equipements" className="text-sm text-muted-foreground underline">
          ← Parc matériel
        </Link>
        <h1 className="text-2xl font-semibold">Univers</h1>
        <p className="text-sm text-muted-foreground">
          Un univers regroupe des matériels d&apos;un même domaine (ex. : chauffage-ventilation, électricité,
          biomédical). Créez d&apos;abord vos univers, puis ajoutez-y vos équipements.
        </p>
      </div>

      {role !== "lecture" && (
        <section className="grid gap-3 rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">Nouvel univers</h2>
          <Formulaire action={creerUnivers} libelle="Créer l'univers" reinitialiser>
            <ChampTexte
              nom="libelle"
              libelle="Nom"
              required
              maxLength={120}
              placeholder="Ex. : Chauffage-ventilation"
            />
            <ChampTexte nom="description" libelle="Description" maxLength={500} />
          </Formulaire>
        </section>
      )}

      {univers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Aucun univers. Créez le premier ci-dessus.
        </p>
      ) : (
        <ul className="grid gap-2">
          {univers.map((u) => (
            <li key={u.id} className="grid gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-0.5">
                  <Link
                    href={`/equipements?univers=${u.id}`}
                    className="text-lg font-semibold underline-offset-2 hover:underline"
                  >
                    {u.libelle}
                  </Link>
                  {u.description && <span className="text-sm text-muted-foreground">{u.description}</span>}
                  <span className="text-sm text-muted-foreground">
                    {u.nb_equipements} équipement{u.nb_equipements > 1 ? "s" : ""}
                  </span>
                </div>
                {role !== "lecture" && (
                  <LienBouton href={`/equipements/nouveau?univers=${u.id}`} variante="secondary">
                    <Plus className="size-4" aria-hidden />
                    Ajouter un équipement
                  </LienBouton>
                )}
              </div>
              {role === "admin" && u.nb_equipements === 0 && (
                <Formulaire
                  action={archiverUnivers.bind(null, u.id)}
                  libelle="Archiver"
                  variante="outline"
                  confirmation="Archiver cet univers ?"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
