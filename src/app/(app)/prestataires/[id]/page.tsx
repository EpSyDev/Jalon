import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Plus } from "lucide-react";
import { z } from "zod";
import { BadgeAlerteContrat } from "@/components/alerte-contrat";
import { BadgeStatut } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { alerteContrat } from "@/lib/metier/contrats";
import { aujourdhuiParis, type StatutEcheance } from "@/lib/metier/echeance";
import { lirePrestataire, listerContrats, plansDuPrestataire, seuilAEcheance } from "@/lib/requetes/contrats";

export const metadata = { title: "Prestataire — Jalon" };

export default async function PagePrestataire({ params }: PageProps<"/prestataires/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const prestataire = await lirePrestataire(tx, id);
    if (!prestataire) return null;
    const [contrats, plans, seuil] = await Promise.all([
      listerContrats(tx, id),
      plansDuPrestataire(tx, id),
      seuilAEcheance(tx),
    ]);
    return { prestataire, contrats, plans, seuil, role: u.role };
  });
  if (!donnees) notFound();
  const { prestataire: p, contrats, plans, seuil, role } = donnees;
  const peutEcrire = role !== "lecture";
  const aujourdhui = aujourdhuiParis();

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/prestataires" className="text-sm text-muted-foreground underline">
          ← Prestataires
        </Link>
        <h1 className="text-2xl font-semibold">{p.nom}</h1>
        {p.contact_nom && <p className="text-muted-foreground">{p.contact_nom}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {p.telephone && (
          <LienBouton href={`tel:${p.telephone.replace(/[^0-9+]/g, "")}`} className="h-12 text-base">
            <Phone className="size-4" aria-hidden />
            Appeler
          </LienBouton>
        )}
        {p.email && (
          <LienBouton href={`mailto:${p.email}`} variante="outline" className="h-12 text-base">
            <Mail className="size-4" aria-hidden />
            Écrire
          </LienBouton>
        )}
        {peutEcrire && (
          <LienBouton href={`/prestataires/${p.id}/modifier`} variante="outline" className="h-12 text-base">
            Modifier
          </LienBouton>
        )}
      </div>

      <dl className="grid gap-4 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Téléphone</dt>
          <dd>{p.telephone ?? "—"}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Adresse mail</dt>
          <dd className="break-all">{p.email ?? "—"}</dd>
        </div>
        {p.notes && (
          <div className="grid gap-0.5 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{p.notes}</dd>
          </div>
        )}
      </dl>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Contrats ({contrats.length})</h2>
          {peutEcrire && (
            <Link
              href={`/contrats/nouveau?prestataire=${p.id}`}
              className="inline-flex items-center gap-1 text-sm underline"
            >
              <Plus className="size-4" aria-hidden />
              Ajouter
            </Link>
          )}
        </div>
        {contrats.length === 0 && <p className="text-sm text-muted-foreground">Aucun contrat.</p>}
        <ul className="grid gap-2">
          {contrats.map((c) => (
            <li key={c.id}>
              <Link href={`/contrats/${c.id}`} className="grid gap-1 rounded-lg border p-3 text-sm hover:bg-muted/50">
                <span className="font-medium">{c.objet}</span>
                <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <BadgeAlerteContrat alerte={alerteContrat(c, aujourdhui, seuil)} />
                  {c.date_fin ? `fin le ${formaterDate(c.date_fin)}` : "sans date de fin"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Contrôles confiés ({plans.length})</h2>
        {plans.length === 0 && <p className="text-sm text-muted-foreground">Aucun contrôle.</p>}
        <ul className="grid gap-2">
          {plans.map((pl) => (
            <li key={pl.plan_controle_id}>
              <Link
                href={`/controles/plans/${pl.plan_controle_id}`}
                className="grid gap-1 rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{pl.type_libelle}</span>
                <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <BadgeStatut statut={pl.statut_echeance as StatutEcheance} />
                  {pl.perimetre}
                  {pl.prochaine_echeance && ` · échéance ${formaterDate(pl.prochaine_echeance)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
