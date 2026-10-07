import Link from "next/link";
import type { ReactNode } from "react";
import { ChampListe, ChampTexte, versOptions } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { LIBELLES_CARACTERE, LIBELLES_RESULTAT } from "@/lib/format";
import { CARACTERES } from "@/lib/metier/controles";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { optionsNouveauControle } from "@/lib/requetes/nouveau-controle";
import { creerNouveauControle } from "../actions";

export const metadata = { title: "Nouveau contrôle — Jalon" };

function Etape({ numero, titre, children }: { numero: number; titre: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-lg border bg-card p-4">
      <legend className="px-2 text-lg font-semibold">
        <span className="mr-2 font-mono text-sm text-muted-foreground">{numero}</span>
        {titre}
      </legend>
      {children}
    </fieldset>
  );
}

/** Un seul formulaire : quel contrôle, sur quoi, et quand il a été fait pour la dernière fois. */
export default async function PageNouveauControle({ searchParams }: PageProps<"/controles/nouveau">) {
  const params = await searchParams;
  const options = await requete((tx) => optionsNouveauControle(tx), ["admin", "technicien"]);
  const un = (v: unknown) => (typeof v === "string" ? v : undefined);
  const famille = options.familles.find((f) => f.id === un(params.famille))?.id ?? "";
  const caractere = CARACTERES.find((c) => c === un(params.caractere)) ?? "";
  const equipement = options.equipements.find((e) => e.id === un(params.equipement))?.id ?? "";

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <div className="grid gap-1">
        <Link href="/controles" className="text-sm text-muted-foreground underline">
          ← Contrôles
        </Link>
        <h1 className="text-2xl font-semibold">Nouveau contrôle</h1>
        <p className="text-sm text-muted-foreground">
          Trois étapes. Jalon calcule ensuite l&apos;échéance et vous prévient avant qu&apos;elle n&apos;arrive.
        </p>
      </div>

      <Formulaire action={creerNouveauControle} libelle="Créer le contrôle" className="gap-6">
        <Etape numero={1} titre="Quel contrôle ?">
          <ChampListe
            nom="famille_id"
            libelle="Famille"
            defaultValue={famille}
            vide={options.familles.length ? "Choisir une famille…" : "Aucune famille : saisir ci-dessous"}
            options={options.familles.map((f) => ({ valeur: f.id, libelle: f.libelle }))}
          />
          <ChampTexte
            nom="famille_nouvelle"
            libelle="Ou nouvelle famille"
            maxLength={120}
            placeholder="Ex. : Électricité"
            aide="Seulement si la famille n'est pas dans la liste."
          />
          <ChampListe
            nom="caractere"
            libelle="Caractère"
            required
            defaultValue={caractere}
            vide="Choisir…"
            options={versOptions(LIBELLES_CARACTERE)}
            aide="Par exemple en électricité : un contrôle réglementaire et un contrôle interne sont deux contrôles distincts."
          />
          <ChampTexte
            nom="libelle"
            libelle="Intitulé du contrôle"
            required
            maxLength={200}
            placeholder="Ex. : Vérification des installations électriques"
          />
          <ChampTexte
            nom="periodicite_mois"
            libelle="Tous les combien de mois ?"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={120}
            aide="À reprendre du texte applicable ou de votre décision : aucune valeur n'est proposée."
          />
          <ChampTexte
            nom="reference_texte"
            libelle="Référence du texte"
            maxLength={500}
            placeholder="Article, arrêté, référentiel… (facultatif)"
          />
        </Etape>

        <Etape numero={2} titre="Sur quoi, et par qui ?">
          <ChampListe
            nom="equipement_id"
            libelle="Équipement"
            defaultValue={equipement}
            vide="Aucun : installation entière"
            options={options.equipements.map((e) => ({ valeur: e.id, libelle: e.libelle }))}
          />
          <ChampTexte
            nom="perimetre_libelle"
            libelle="Ou périmètre"
            maxLength={200}
            placeholder="Ex. : ensemble du site, bâtiment B"
            aide="Obligatoire si aucun équipement n'est choisi."
          />
          <ChampListe
            nom="prestataire_id"
            libelle="Prestataire"
            defaultValue=""
            vide="Non renseigné"
            options={options.prestataires.map((p) => ({ valeur: p.id, libelle: p.libelle }))}
          />
        </Etape>

        <Etape numero={3} titre="Dernier contrôle connu (facultatif)">
          <p className="text-sm text-muted-foreground">
            Sans date, le contrôle apparaît « jamais contrôlé » jusqu&apos;à sa première saisie.
          </p>
          <ChampTexte nom="date_dernier" libelle="Date" type="date" max={aujourdhuiParis()} />
          <ChampListe
            nom="resultat"
            libelle="Résultat"
            defaultValue=""
            vide="Choisir si une date est indiquée"
            options={versOptions(LIBELLES_RESULTAT)}
          />
          <ChampTexte
            nom="nb_reserves_declare"
            libelle="Nombre de réserves"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            defaultValue={0}
          />
        </Etape>
      </Formulaire>
    </div>
  );
}
