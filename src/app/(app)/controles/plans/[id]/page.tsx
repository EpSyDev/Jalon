import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPlus } from "lucide-react";
import { z } from "zod";
import { BadgeReserves, BadgeStatut } from "@/components/badges";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_CARACTERE, LIBELLES_GRAVITE, LIBELLES_RESULTAT } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { historiqueControles, lirePlan, reservesDuPlan } from "@/lib/requetes/controles";
import { archiverControle, leverReserve, rouvrirReserve } from "../../actions";
import { HistoriqueFiche } from "@/components/journal";
import { HISTORIQUE_VIDE, historiqueFiche } from "@/lib/requetes/journal";

export const metadata = { title: "Plan de contrôle — Jalon" };

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function PageFichePlan({ params }: PageProps<"/controles/plans/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const donnees = await requete(async (tx, u) => {
    const plan = await lirePlan(tx, id);
    if (!plan) return null;
    const [controles, reserves, journal] = await Promise.all([
      historiqueControles(tx, id),
      reservesDuPlan(tx, id),
      u.role === "admin" ? historiqueFiche(tx, "plans_controle", id) : HISTORIQUE_VIDE,
    ]);
    return { plan, controles, reserves, journal, role: u.role };
  });
  if (!donnees) notFound();

  const { plan, controles, reserves, journal, role } = donnees;
  const peutEcrire = role !== "lecture";
  const aujourdhui = aujourdhuiParis();
  const ouvertes = reserves.filter((r) => r.statut === "ouverte");
  const levees = reserves.filter((r) => r.statut === "levee");
  const periodicite = plan.periodicite_mois_surcharge ?? plan.type_periodicite_mois;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <Link href="/controles" className="text-sm text-muted-foreground underline">
          ← Contrôles
        </Link>
        <h1 className="text-2xl font-semibold">{plan.type_libelle}</h1>
        <div className="flex flex-wrap gap-2">
          <BadgeStatut statut={plan.statut_echeance} />
          <BadgeReserves ouvertes={ouvertes.length} />
        </div>
        {plan.archive_le && (
          <p className="rounded-md bg-muted p-3 text-sm">Plan archivé : il ne génère plus d&apos;alerte.</p>
        )}
        {!plan.actif && !plan.archive_le && (
          <p className="rounded-md bg-muted p-3 text-sm">Plan inactif : il ne génère pas d&apos;alerte.</p>
        )}
      </div>

      {peutEcrire && !plan.archive_le && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <LienBouton href={`/controles/saisie?plan=${plan.id}`} className="h-14 text-base">
            <ClipboardPlus className="size-5" aria-hidden />
            J&apos;ai fait le contrôle
          </LienBouton>
          <LienBouton href={`/controles/plans/${plan.id}/modifier`} variante="outline" className="h-14 text-base">
            Modifier le plan
          </LienBouton>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 text-sm">
        <Info libelle="Prochaine échéance">{formaterDate(plan.prochaine_echeance)}</Info>
        <Info libelle="Dernier contrôle">{formaterDate(plan.dernier_controle)}</Info>
        <Info libelle="Périmètre">
          {plan.equipement_id ? `${plan.equipement_code} — ${plan.equipement_libelle}` : plan.perimetre_libelle}
          {plan.equipement_id && plan.perimetre_libelle && ` (${plan.perimetre_libelle})`}
        </Info>
        <Info libelle="Périodicité">
          {periodicite} mois{plan.periodicite_mois_surcharge !== null && " (spécifique à ce plan)"}
        </Info>
        <Info libelle="Caractère">{LIBELLES_CARACTERE[plan.caractere]}</Info>
        <Info libelle="Prestataire">{plan.prestataire_nom ?? "—"}</Info>
        <Info libelle="Contrat">{plan.contrat_objet ?? "—"}</Info>
        <Info libelle="Référence du texte">{plan.reference_texte ?? "—"}</Info>
      </dl>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Réserves ouvertes ({ouvertes.length})</h2>
        {ouvertes.length === 0 && <p className="text-sm text-muted-foreground">Aucune réserve ouverte.</p>}
        {ouvertes.map((r) => {
          const depassee = r.echeance_levee !== null && r.echeance_levee < aujourdhui;
          return (
            <article key={r.id} className="grid gap-3 rounded-lg border bg-card p-4">
              <div className="grid gap-1">
                <div className="font-medium">{r.description}</div>
                <div className="text-sm text-muted-foreground">
                  {r.gravite ? LIBELLES_GRAVITE[r.gravite] : "Gravité à préciser"} · constatée le{" "}
                  {formaterDate(r.date_constat)}
                  {r.echeance_levee && (
                    <span className={depassee ? "font-medium text-destructive" : undefined}>
                      {" "}
                      · à lever avant le {formaterDate(r.echeance_levee)}
                      {depassee && " (dépassée)"}
                    </span>
                  )}
                </div>
              </div>
              {peutEcrire && (
                <div className="grid grid-cols-2 gap-2">
                  <Formulaire
                    action={leverReserve.bind(null, r.id, plan.id)}
                    libelle="Levée aujourd'hui"
                    variante="secondary"
                  >
                    <input type="hidden" name="date_levee" value={aujourdhui} />
                  </Formulaire>
                  <LienBouton href={`/controles/reserves/${r.id}`} variante="outline" className="h-12 text-base">
                    Détailler
                  </LienBouton>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {levees.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Réserves levées ({levees.length})</h2>
          <ul className="grid gap-2">
            {levees.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
              >
                <span>
                  {r.description} — levée le {formaterDate(r.date_levee)}
                </span>
                {peutEcrire && (
                  <Formulaire
                    action={rouvrirReserve.bind(null, r.id, plan.id)}
                    libelle="Rouvrir"
                    variante="outline"
                    confirmation="Rouvrir cette réserve ?"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Historique des contrôles ({controles.length})</h2>
        {controles.length === 0 && (
          <p className="text-sm text-muted-foreground">Jamais contrôlé : enregistrez le dernier contrôle connu.</p>
        )}
        <ol className="grid gap-2">
          {controles.map((c) => (
            <li key={c.id} className="grid gap-1 rounded-lg border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{formaterDate(c.date_realisation)}</span>
                <span>{LIBELLES_RESULTAT[c.resultat]}</span>
              </div>
              {c.reference_rapport && (
                <div className="break-all text-muted-foreground">Rapport : {c.reference_rapport}</div>
              )}
              {c.commentaire && <div className="whitespace-pre-line">{c.commentaire}</div>}
              {c.saisi_par && <div className="text-xs text-muted-foreground">Saisi par {c.saisi_par}</div>}
              {role === "admin" && (
                <Formulaire
                  action={archiverControle.bind(null, plan.id, c.id)}
                  libelle="Retirer (saisie erronée)"
                  variante="outline"
                  confirmation="Retirer ce contrôle ? L'échéance sera recalculée. L'opération reste tracée dans le journal."
                  className="mt-2"
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      <HistoriqueFiche entrees={journal.entrees} noms={journal.noms} table="plans_controle" />
    </div>
  );
}
