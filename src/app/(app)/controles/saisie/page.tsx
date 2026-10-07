import Link from "next/link";
import { ChampListe, ChampTexte, ChampZoneTexte, versOptions } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_RESULTAT, LIBELLES_STATUT } from "@/lib/format";
import { aujourdhuiParis, prochaineEcheance } from "@/lib/metier/echeance";
import { cheminSur } from "@/lib/metier/parc";
import { listerPlans } from "@/lib/requetes/controles";
import { enregistrerControle } from "../actions";

export const metadata = { title: "Saisir un contrôle — Jalon" };

export default async function PageSaisieControle({ searchParams }: PageProps<"/controles/saisie">) {
  const { plan: planDemande, retour: retourDemande } = await searchParams;
  // Retour à la tournée après la saisie, sinon fiche du plan (action).
  const retour = cheminSur(retourDemande).startsWith("/controles/tournee") ? cheminSur(retourDemande) : null;
  const plans = await requete((tx) => listerPlans(tx), ["admin", "technicien"]);
  const aujourdhui = aujourdhuiParis();
  const choisi = plans.find((p) => p.plan_controle_id === planDemande);

  if (plans.length === 0) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
        <h1 className="text-2xl font-semibold">Saisir un contrôle</h1>
        <p className="text-muted-foreground">Aucun contrôle actif.</p>
        <LienBouton href="/controles/nouveau">Créer un contrôle</LienBouton>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Saisir un contrôle</h1>
      <Formulaire action={enregistrerControle} libelle="Enregistrer le contrôle">
        {retour && <input type="hidden" name="retour" value={retour} />}
        {choisi ? (
          <div className="grid gap-1 rounded-lg border bg-card p-4">
            <input type="hidden" name="plan_controle_id" value={choisi.plan_controle_id} />
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{choisi.type_libelle}</div>
              <Link href="/controles/saisie" className="shrink-0 text-sm underline">
                Changer
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              {[choisi.equipement_code, choisi.perimetre].filter(Boolean).join(" — ")}
            </div>
            <div className="text-sm">
              Périodicité {choisi.periodicite_mois} mois : si réalisé aujourd&apos;hui, prochaine échéance le{" "}
              {formaterDate(prochaineEcheance(aujourdhui, choisi.periodicite_mois))}.
            </div>
          </div>
        ) : (
          <ChampListe
            nom="plan_controle_id"
            libelle="Plan de contrôle"
            defaultValue=""
            vide="Choisir…"
            required
            options={plans.map((p) => ({
              valeur: p.plan_controle_id,
              libelle: `${p.type_libelle} — ${[p.equipement_code, p.perimetre].filter(Boolean).join(" ")} (${LIBELLES_STATUT[p.statut_echeance].toLowerCase()})`,
            }))}
          />
        )}
        <ChampTexte
          nom="date_realisation"
          libelle="Date de réalisation"
          type="date"
          defaultValue={aujourdhui}
          max={aujourdhui}
          required
        />
        <ChampListe
          nom="resultat"
          libelle="Résultat"
          defaultValue="conforme"
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
          aide="Les réserves sont créées « à détailler » ; vous pourrez les compléter depuis la fiche du plan."
        />
        <ChampTexte
          nom="reference_rapport"
          libelle="Référence du rapport"
          maxLength={500}
          placeholder="Nom de fichier, chemin réseau ou lien GED"
        />
        <ChampZoneTexte nom="commentaire" libelle="Commentaire" />
      </Formulaire>
    </div>
  );
}
