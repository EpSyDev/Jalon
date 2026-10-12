import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ClipboardPlus, QrCode, Wrench } from "lucide-react";
import { z } from "zod";
import { BadgeReserves, BadgeStatut } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_RESULTAT } from "@/lib/format";
import { lienTelephone } from "@/lib/metier/contacts";
import { AUCUN } from "@/lib/metier/parc";
import { entourageEquipement } from "@/lib/requetes/entourage-equipement";
import { ficheEquipement, lireEquipement, optionsEquipement } from "@/lib/requetes/parc";
import { HistoriqueFiche } from "@/components/journal";
import { HISTORIQUE_VIDE, historiqueFiche } from "@/lib/requetes/journal";
import { archiverEquipement, changerStatutEquipement, modifierEquipement } from "../actions";
import { adresseParc } from "../filtres";
import { PanneauInfos } from "./panneau-infos";
import { PanneauStatut } from "./panneau-statut";

export const metadata = { title: "Équipement — Jalon" };

const STATUTS_INTERVENTION: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  terminee: "Terminée",
  annulee: "Annulée",
};

export default async function PageEquipement({ params, searchParams }: PageProps<"/equipements/[id]">) {
  const { id } = await params;
  const { modifier } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const equipement = await lireEquipement(tx, id);
    if (!equipement) return null;
    const journal = u.role === "admin" ? await historiqueFiche(tx, "equipements", id) : HISTORIQUE_VIDE;
    return {
      equipement,
      ...(await ficheEquipement(tx, id)),
      entourage: await entourageEquipement(tx, id),
      options: u.role !== "lecture" ? await optionsEquipement(tx) : null,
      journal,
      role: u.role,
    };
  });
  if (!donnees) notFound();
  const { equipement: e, plans, controles, interventions, entourage, options, journal, role } = donnees;
  const peutEcrire = role !== "lecture";
  const interventionOuverte = interventions.some((i) => i.statut !== "terminee" && i.statut !== "annulee");

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href="/equipements" className="underline">
            Parc
          </Link>
          {e.univers_id && (
            <>
              <ChevronRight className="size-3.5" aria-hidden />
              <Link href={adresseParc({ univers: e.univers_id })} className="underline">
                {e.univers}
              </Link>
            </>
          )}
          {e.categorie_id && (
            <>
              <ChevronRight className="size-3.5" aria-hidden />
              <Link
                href={adresseParc({ univers: e.univers_id ?? AUCUN, categorie: e.categorie_id })}
                className="underline"
              >
                {e.categorie}
              </Link>
            </>
          )}
        </nav>
        <h1 className="text-2xl font-semibold">
          {e.code} — {e.libelle}
        </h1>
        {e.localisation && <p className="text-sm text-muted-foreground">{e.localisation}</p>}
      </div>

      <PanneauStatut
        statut={e.statut}
        depuis={e.statut_depuis}
        motif={e.statut_motif}
        prestataire={e.prestataire}
        retourPrevu={e.statut_retour_prevu}
        prestataires={options?.prestataires ?? []}
        interventionOuverte={interventionOuverte}
        action={changerStatutEquipement.bind(null, e.id)}
        peutEcrire={peutEcrire}
      />

      {peutEcrire && (
        <div className="grid gap-2 sm:grid-cols-2">
          <LienBouton href={`/interventions/nouvelle?equipement=${e.id}`} className="h-12 text-base">
            <Wrench className="size-5" aria-hidden />
            Déclarer une intervention
          </LienBouton>
          <LienBouton href={`/equipements/etiquettes?ids=${e.id}`} variante="outline" className="h-12 text-base">
            <QrCode className="size-5" aria-hidden />
            Imprimer l&apos;étiquette QR
          </LienBouton>
        </div>
      )}

      <PanneauInfos
        equipement={e}
        options={options ?? { univers: [], categories: [], localisations: [], prestataires: [] }}
        action={peutEcrire ? modifierEquipement.bind(null, e.id) : undefined}
        archiver={role === "admin" ? archiverEquipement.bind(null, e.id) : undefined}
        ouvertParDefaut={modifier === "1"}
      />

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Contrôles ({plans.length})</h2>
          {peutEcrire && (
            <Link href={`/controles/nouveau?equipement=${e.id}`} className="text-sm underline">
              Ajouter un contrôle
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
                  Effectué
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

      {(entourage.partenaires.length > 0 || entourage.contrats.length > 0 || entourage.chantiers.length > 0) && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Qui, quoi, avec quel contrat</h2>
          <ul className="grid gap-2">
            {entourage.partenaires.map((p) => (
              <li key={p.id} className="grid gap-2 rounded-lg border bg-card p-3 text-sm">
                <Link href={`/prestataires/${p.id}`} className="font-medium underline">
                  {p.nom}
                </Link>
                {p.contacts.length === 0 ? (
                  <span className="text-muted-foreground">Aucun contact dans l&apos;annuaire.</span>
                ) : (
                  <ul className="grid gap-1.5">
                    {p.contacts.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/contacts/${c.id}`} className="underline-offset-2 hover:underline">
                          {c.nom}
                          {c.fonction && <span className="text-muted-foreground"> · {c.fonction}</span>}
                        </Link>
                        <span className="flex gap-2">
                          {c.telephone && (
                            <a
                              href={lienTelephone(c.telephone)}
                              className="inline-flex min-h-11 items-center rounded-md border px-3"
                            >
                              {c.telephone}
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              aria-label={`Écrire à ${c.nom}`}
                              className="inline-flex min-h-11 items-center rounded-md border px-3"
                            >
                              Mail
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {entourage.contrats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/contrats/${c.id}`}
                  className="grid gap-0.5 rounded-lg border bg-card p-3 text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">Contrat : {c.objet}</span>
                  <span className="text-muted-foreground">
                    {c.prestataire_nom}
                    {c.date_fin ? ` · fin le ${formaterDate(c.date_fin)}` : " · sans date de fin"}
                  </span>
                </Link>
              </li>
            ))}
            {entourage.chantiers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chantiers/${c.id}`}
                  className="block rounded-lg border bg-card p-3 text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">Chantier : {c.titre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      <HistoriqueFiche entrees={journal.entrees} noms={journal.noms} table="equipements" />
    </div>
  );
}
