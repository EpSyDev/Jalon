import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BadgeAlerteContrat, messageAlerteContrat } from "@/components/alerte-contrat";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { alerteContrat, limitePreavis } from "@/lib/metier/contrats";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { lireContrat, plansDuContrat, seuilAEcheance } from "@/lib/requetes/contrats";

export const metadata = { title: "Contrat — Jalon" };

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function PageContrat({ params }: PageProps<"/contrats/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const contrat = await lireContrat(tx, id);
    if (!contrat) return null;
    return { contrat, plans: await plansDuContrat(tx, id), seuil: await seuilAEcheance(tx), role: u.role };
  });
  if (!donnees) notFound();
  const { contrat: c, plans, seuil, role } = donnees;
  const alerte = alerteContrat(c, aujourdhuiParis(), seuil);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/contrats" className="text-sm text-muted-foreground underline">
          ← Contrats
        </Link>
        <h1 className="text-2xl font-semibold">{c.objet}</h1>
        <Link href={`/prestataires/${c.prestataire_id}`} className="w-fit text-muted-foreground underline">
          {c.prestataire_nom}
        </Link>
      </div>

      {alerte && (
        <p
          className={
            alerte === "a_decider"
              ? "flex flex-wrap items-center gap-2 rounded-lg bg-amber-400/20 p-4"
              : "flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive"
          }
        >
          <BadgeAlerteContrat alerte={alerte} />
          {messageAlerteContrat(c, alerte)}
        </p>
      )}

      {role !== "lecture" && (
        <LienBouton href={`/contrats/${c.id}/modifier`} variante="outline" className="h-12 text-base">
          Modifier
        </LienBouton>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <Info libelle="Début">{formaterDate(c.date_debut)}</Info>
        <Info libelle="Fin">{formaterDate(c.date_fin)}</Info>
        <Info libelle="Préavis">{c.preavis_jours !== null ? `${c.preavis_jours} jours` : "—"}</Info>
        <Info libelle="Limite pour dénoncer">
          {c.date_fin ? formaterDate(limitePreavis(c.date_fin, c.preavis_jours)) : "—"}
        </Info>
        <Info libelle="Reconduction tacite">{c.reconduction_tacite ? "Oui" : "Non"}</Info>
        <Info libelle="Montant annuel">{c.montant_annuel ? euros.format(Number(c.montant_annuel)) : "—"}</Info>
        <Info libelle="Référence">{c.reference ?? "—"}</Info>
        <Info libelle="Document">
          <span className="break-all">{c.reference_document ?? "—"}</span>
        </Info>
        {c.notes && (
          <div className="col-span-2 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{c.notes}</dd>
          </div>
        )}
      </dl>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Contrôles couverts ({plans.length})</h2>
        {plans.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun plan de contrôle rattaché (champ « Contrat » du plan).</p>
        )}
        <ul className="grid gap-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/controles/plans/${p.id}`} className="block rounded-lg border p-3 text-sm hover:bg-muted/50">
                {p.libelle}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
