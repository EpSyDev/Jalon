import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  estCloture,
  LIBELLES_STATUT_INTERVENTION,
  LIBELLES_TYPE_INTERVENTION,
  transitionsPossibles,
  type StatutIntervention,
} from "@/lib/metier/interventions";
import { lireIntervention } from "@/lib/requetes/interventions";
import { changerStatut } from "../actions";
import { BadgePriorite } from "../champs-intervention";

export const metadata = { title: "Intervention — Jalon" };

const VARIANTES: Record<StatutIntervention, "default" | "outline" | "secondary"> = {
  en_cours: "default",
  en_attente: "secondary",
  terminee: "default",
  annulee: "outline",
  a_faire: "outline",
};

function libelleAction(actuel: StatutIntervention, cible: StatutIntervention): string {
  if (cible === "en_cours") return actuel === "a_faire" ? "Démarrer" : actuel === "terminee" ? "Rouvrir" : "Reprendre";
  if (cible === "en_attente") return "Mettre en attente";
  if (cible === "annulee") return "Annuler l'intervention";
  if (cible === "a_faire") return "Rétablir « à faire »";
  return "Terminer";
}

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function PageIntervention({ params }: PageProps<"/interventions/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const intervention = await lireIntervention(tx, id);
    return intervention ? { intervention, role: u.role } : null;
  });
  if (!donnees) notFound();
  const { intervention: i, role } = donnees;
  const peutEcrire = role !== "lecture";
  const aujourdhui = aujourdhuiParis();
  const transitions = transitionsPossibles(i.statut);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/interventions" className="text-sm text-muted-foreground underline">
          ← Interventions
        </Link>
        <h1 className="text-2xl font-semibold">{i.titre}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <BadgePriorite priorite={i.priorite} />
          <span className="font-medium">{LIBELLES_STATUT_INTERVENTION[i.statut]}</span>
          {i.date_cloture && <span className="text-muted-foreground">le {formaterDate(i.date_cloture)}</span>}
        </div>
      </div>

      {peutEcrire && (
        <section className="grid gap-3 rounded-lg border p-4" aria-label="Changer le statut">
          {transitions.includes("terminee") && (
            <Formulaire action={changerStatut.bind(null, i.id)} libelle="Terminer l'intervention" className="gap-3">
              <input type="hidden" name="statut" value="terminee" />
              <ChampTexte
                nom="date_cloture"
                libelle="Date de fin"
                type="date"
                defaultValue={aujourdhui}
                min={i.date_demande}
                max={aujourdhui}
                required
              />
            </Formulaire>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {transitions
              .filter((t) => t !== "terminee")
              .map((t) => (
                <Formulaire
                  key={t}
                  action={changerStatut.bind(null, i.id)}
                  libelle={libelleAction(i.statut, t)}
                  variante={VARIANTES[t]}
                  confirmation={t === "annulee" ? "Annuler cette intervention ?" : undefined}
                >
                  <input type="hidden" name="statut" value={t} />
                </Formulaire>
              ))}
          </div>
          {!estCloture(i.statut) && (
            <LienBouton href={`/interventions/${i.id}/modifier`} variante="outline" className="h-12 text-base">
              Modifier
            </LienBouton>
          )}
        </section>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <Info libelle="Type">{LIBELLES_TYPE_INTERVENTION[i.type]}</Info>
        <Info libelle="Demandée le">{formaterDate(i.date_demande)}</Info>
        <Info libelle="Prévue le">{formaterDate(i.date_prevue)}</Info>
        <Info libelle="Assignée à">{i.assignee_nom ?? "—"}</Info>
        <Info libelle="Prestataire">{i.prestataire_nom ?? "—"}</Info>
        <Info libelle="Créée par">{i.cree_par ?? "—"}</Info>
        <Info libelle="Équipement">
          {i.equipement_id ? (
            <Link href={`/equipements/${i.equipement_id}`} className="underline">
              {i.equipement_code} — {i.equipement_libelle}
            </Link>
          ) : (
            "—"
          )}
        </Info>
        <Info libelle="Chantier">
          {i.chantier_id ? (
            <Link href={`/chantiers/${i.chantier_id}`} className="underline">
              {i.chantier_titre}
            </Link>
          ) : (
            "—"
          )}
        </Info>
        <Info libelle="Plan de contrôle">
          {i.plan_controle_id ? (
            <Link href={`/controles/plans/${i.plan_controle_id}`} className="underline">
              {i.plan_libelle}
            </Link>
          ) : (
            "—"
          )}
        </Info>
        {i.description && (
          <div className="col-span-2 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-line">{i.description}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
