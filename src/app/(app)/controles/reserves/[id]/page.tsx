import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChampListe, ChampTexte, ChampZoneTexte, versOptions } from "@/components/champs";
import { Wrench } from "lucide-react";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_GRAVITE } from "@/lib/format";
import { lireReserve } from "@/lib/requetes/controles";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { leverReserve, modifierReserve } from "../../actions";

export const metadata = { title: "Réserve — Jalon" };

export default async function PageReserve({ params }: PageProps<"/controles/reserves/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const reserve = await requete((tx) => lireReserve(tx, id), ["admin", "technicien"]);
  if (!reserve) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/controles/plans/${reserve.plan_controle_id}`} className="text-sm text-muted-foreground underline">
        ← {reserve.type_libelle}
      </Link>
      <h1 className="text-2xl font-semibold">Réserve</h1>
      <p className="text-sm text-muted-foreground">Constatée le {formaterDate(reserve.date_constat)}</p>
      <Formulaire action={modifierReserve.bind(null, reserve.id, reserve.plan_controle_id)} libelle="Enregistrer">
        <ChampZoneTexte
          nom="description"
          libelle="Description"
          required
          defaultValue={reserve.description === "À détailler" ? "" : reserve.description}
          placeholder="Ce que le rapport demande de corriger"
        />
        <ChampListe
          nom="gravite"
          libelle="Gravité"
          defaultValue={reserve.gravite ?? ""}
          vide="À préciser"
          options={versOptions(LIBELLES_GRAVITE)}
        />
        <ChampTexte
          nom="echeance_levee"
          libelle="À lever avant le"
          type="date"
          min={reserve.date_constat}
          defaultValue={reserve.echeance_levee ?? ""}
        />
        <ChampZoneTexte nom="commentaire" libelle="Commentaire" defaultValue={reserve.commentaire ?? ""} />
      </Formulaire>
      {reserve.statut === "ouverte" && (
        <LienBouton
          href={`/interventions/nouvelle?reserve=${reserve.id}`}
          variante="outline"
          className="h-12 text-base"
        >
          <Wrench className="size-4" aria-hidden />
          Créer l'intervention pour la lever
        </LienBouton>
      )}
      {reserve.statut === "ouverte" && (
        <section className="grid gap-3 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Levée à une autre date</h2>
          <Formulaire
            action={leverReserve.bind(null, reserve.id, reserve.plan_controle_id)}
            libelle="Marquer levée"
            variante="secondary"
          >
            <ChampTexte
              nom="date_levee"
              libelle="Date de levée"
              type="date"
              min={reserve.date_constat}
              max={aujourdhuiParis()}
              defaultValue={aujourdhuiParis()}
              required
            />
          </Formulaire>
        </section>
      )}
    </div>
  );
}
