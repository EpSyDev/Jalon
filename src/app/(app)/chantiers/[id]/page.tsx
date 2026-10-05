import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { z } from "zod";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { LIBELLES_STATUT_CHANTIER, LIBELLES_STATUT_INTERVENTION } from "@/lib/metier/interventions";
import { interventionsDuChantier, lireChantier } from "@/lib/requetes/interventions";
import { BadgePriorite } from "../../interventions/champs-intervention";

export const metadata = { title: "Chantier — Jalon" };

export default async function PageChantier({ params }: PageProps<"/chantiers/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const chantier = await lireChantier(tx, id);
    return chantier ? { chantier, interventions: await interventionsDuChantier(tx, id), role: u.role } : null;
  });
  if (!donnees) notFound();
  const { chantier: c, interventions, role } = donnees;
  const peutEcrire = role !== "lecture";

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/chantiers" className="text-sm text-muted-foreground underline">
          ← Chantiers
        </Link>
        <h1 className="text-2xl font-semibold">{c.titre}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{LIBELLES_STATUT_CHANTIER[c.statut]}</Badge>
          {c.responsable_nom && <span className="text-muted-foreground">Responsable : {c.responsable_nom}</span>}
        </div>
      </div>

      {peutEcrire && (
        <div className="grid gap-2 sm:grid-cols-2">
          <LienBouton href={`/interventions/nouvelle?chantier=${c.id}`} className="h-12 text-base">
            <Plus className="size-4" aria-hidden />
            Ajouter une intervention
          </LienBouton>
          <LienBouton href={`/chantiers/${c.id}/modifier`} variante="outline" className="h-12 text-base">
            Modifier
          </LienBouton>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-4 rounded-lg border p-4 text-sm">
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Début</dt>
          <dd>{formaterDate(c.date_debut)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Fin prévue</dt>
          <dd>{formaterDate(c.date_fin_prevue)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Fin réelle</dt>
          <dd>{formaterDate(c.date_fin_reelle)}</dd>
        </div>
        {c.description && (
          <div className="col-span-3 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-line">{c.description}</dd>
          </div>
        )}
        {c.notes && (
          <div className="col-span-3 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{c.notes}</dd>
          </div>
        )}
      </dl>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">
          Interventions ({c.nb_ouvertes} ouverte{c.nb_ouvertes > 1 ? "s" : ""} sur {c.nb_total})
        </h2>
        {interventions.length === 0 && <p className="text-sm text-muted-foreground">Aucune intervention rattachée.</p>}
        <ul className="grid gap-2">
          {interventions.map((i) => (
            <li key={i.id}>
              <Link
                href={`/interventions/${i.id}`}
                className="grid gap-1 rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{i.titre}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <BadgePriorite priorite={i.priorite} />
                  {LIBELLES_STATUT_INTERVENTION[i.statut]}
                  {i.assignee_nom && <span className="text-muted-foreground">· {i.assignee_nom}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
