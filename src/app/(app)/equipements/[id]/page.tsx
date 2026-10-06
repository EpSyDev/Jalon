import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPlus, QrCode, Wrench } from "lucide-react";
import { z } from "zod";
import { BadgeReserves, BadgeStatut } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_RESULTAT } from "@/lib/format";
import { ficheEquipement, lireEquipement } from "@/lib/requetes/parc";
import { LIBELLES_STATUT_EQUIPEMENT } from "../champs-equipement";

export const metadata = { title: "Équipement — Jalon" };

const STATUTS_INTERVENTION: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  terminee: "Terminée",
  annulee: "Annulée",
};

function Info({ libelle, valeur }: { libelle: string; valeur: string | null }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd>{valeur ?? "—"}</dd>
    </div>
  );
}

export default async function PageEquipement({ params }: PageProps<"/equipements/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const equipement = await lireEquipement(tx, id);
    return equipement ? { equipement, ...(await ficheEquipement(tx, id)), role: u.role } : null;
  });
  if (!donnees) notFound();
  const { equipement: e, plans, controles, interventions, role } = donnees;
  const peutEcrire = role !== "lecture";

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/equipements" className="text-sm text-muted-foreground underline">
          ← Parc matériel
        </Link>
        <h1 className="text-2xl font-semibold">
          {e.code} — {e.libelle}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant={e.statut === "en_service" ? "secondary" : "outline"}>
            {LIBELLES_STATUT_EQUIPEMENT[e.statut]}
          </Badge>
          {e.localisation && <span className="text-sm text-muted-foreground">{e.localisation}</span>}
        </div>
      </div>

      {peutEcrire && (
        <div className="grid gap-2 sm:grid-cols-2">
          <LienBouton href={`/interventions/nouvelle?equipement=${e.id}`} className="h-14 text-base">
            <Wrench className="size-5" aria-hidden />
            Déclarer une intervention
          </LienBouton>
          <LienBouton href={`/equipements/${e.id}/modifier`} variante="outline" className="h-14 text-base">
            Modifier
          </LienBouton>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 text-sm">
        <Info libelle="Univers" valeur={e.univers} />
        <Info libelle="Famille" valeur={e.famille} />
        <Info libelle="Mise en service" valeur={e.date_mise_en_service && formaterDate(e.date_mise_en_service)} />
        <Info libelle="Marque" valeur={e.marque} />
        <Info libelle="Modèle" valeur={e.modele} />
        <Info libelle="N° de série" valeur={e.numero_serie} />
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Étiquette</dt>
          <dd>
            <Link href={`/equipements/etiquettes?ids=${e.id}`} className="inline-flex items-center gap-1 underline">
              <QrCode className="size-4" aria-hidden />
              Imprimer le QR code
            </Link>
          </dd>
        </div>
        {e.notes && (
          <div className="col-span-2 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{e.notes}</dd>
          </div>
        )}
      </dl>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Contrôles ({plans.length})</h2>
          {peutEcrire && (
            <Link href={`/controles/plans/nouveau?equipement=${e.id}`} className="text-sm underline">
              Ajouter un plan
            </Link>
          )}
        </div>
        {plans.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun contrôle suivi sur cet équipement.</p>
        )}
        <ul className="grid gap-2">
          {plans.map((p) => (
            <li key={p.plan_controle_id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Link href={`/controles/plans/${p.plan_controle_id}`} className="grid min-w-0 flex-1 gap-1">
                <span className="font-medium">{p.type_libelle}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <BadgeStatut statut={p.statut_echeance} />
                  <BadgeReserves ouvertes={p.nb_reserves_ouvertes} />
                  {p.prochaine_echeance && (
                    <span className="text-muted-foreground">Échéance {formaterDate(p.prochaine_echeance)}</span>
                  )}
                </span>
              </Link>
              {peutEcrire && (
                <LienBouton href={`/controles/saisie?plan=${p.plan_controle_id}`} className="h-11 shrink-0">
                  <ClipboardPlus className="size-4" aria-hidden />
                  Fait
                </LienBouton>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Interventions ({interventions.length})</h2>
        {interventions.length === 0 && <p className="text-sm text-muted-foreground">Aucune intervention.</p>}
        <ul className="grid gap-2">
          {interventions.map((i) => (
            <li key={i.id}>
              <Link
                href={`/interventions/${i.id}`}
                className="grid gap-0.5 rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{i.titre}</span>
                <span className="text-muted-foreground">
                  {STATUTS_INTERVENTION[i.statut]} · demandée le {formaterDate(i.date_demande)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Historique des contrôles</h2>
        {controles.length === 0 && <p className="text-sm text-muted-foreground">Aucun contrôle enregistré.</p>}
        <ol className="grid gap-2">
          {controles.map((c) => (
            <li key={c.id}>
              <Link
                href={`/controles/plans/${c.plan_controle_id}`}
                className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <span>
                  <span className="font-medium">{formaterDate(c.date_realisation)}</span> · {c.type_libelle}
                </span>
                <span>{LIBELLES_RESULTAT[c.resultat as keyof typeof LIBELLES_RESULTAT]}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
