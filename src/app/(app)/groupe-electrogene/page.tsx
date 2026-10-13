import Link from "next/link";
import { ChevronRight, ClipboardPlus, Plus } from "lucide-react";
import { BadgeStatut } from "@/components/badges";
import { ChampListe, ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_RESULTAT } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { joursAvantPeremption, LIBELLES_STATUT_EPI, statutEpi, type StatutEpi } from "@/lib/metier/epi";
import { seuilAEcheance } from "@/lib/requetes/contrats";
import { derniersEssais, listerEpi, optionsGroupe, plansGroupe, TYPE_ESSAI } from "@/lib/requetes/groupe-electrogene";
import { cn } from "@/lib/utils";
import { mettreEnPlaceEssai } from "./actions";

export const metadata = { title: "Groupe électrogène — Jalon" };

const STYLE_EPI: Record<StatutEpi, string> = {
  perime: "border-red-600 text-red-700 dark:text-red-400",
  bientot: "border-amber-500 text-amber-800 dark:text-amber-300",
  ok: "border-emerald-600/40 text-emerald-800 dark:text-emerald-300",
  sans_date: "border-border text-muted-foreground",
};

function FormulaireEssai({
  equipements,
  libelle,
}: {
  equipements: { id: string; libelle: string }[];
  libelle: string;
}) {
  return (
    <Formulaire action={mettreEnPlaceEssai} libelle={libelle} reinitialiser>
      <ChampListe
        nom="equipement_id"
        libelle="Groupe électrogène du parc"
        vide="Aucun (je saisis une désignation)"
        options={equipements.map((e) => ({ valeur: e.id, libelle: e.libelle }))}
        aide="Choisissez-le s'il est déjà dans le parc, sinon laissez vide et nommez-le ci-dessous."
      />
      <ChampTexte
        nom="perimetre_libelle"
        libelle="Désignation"
        maxLength={200}
        placeholder="Ex. : Groupe électrogène bâtiment A"
      />
      <ChampTexte
        nom="date_dernier"
        libelle="Date du dernier essai (facultatif)"
        type="date"
        max={aujourdhuiParis()}
        aide="Sans date, le premier essai apparaît « jamais effectué »."
      />
    </Formulaire>
  );
}

export default async function PageGroupeElectrogene() {
  const aujourdhui = aujourdhuiParis();
  const { plans, essais, epi, seuil, options, peutEcrire } = await requete(async (tx, u) => {
    const plans = await plansGroupe(tx);
    const [essais, epi, seuil, options] = await Promise.all([
      derniersEssais(
        tx,
        plans.map((p) => p.plan_controle_id),
      ),
      listerEpi(tx),
      seuilAEcheance(tx),
      optionsGroupe(tx),
    ]);
    return { plans, essais, epi, seuil, options, peutEcrire: u.role !== "lecture" };
  });
  const epiAvecStatut = epi.map((x) => ({ ...x, statut: statutEpi(x.date_peremption, aujourdhui, seuil) }));
  const nbPerimes = epiAvecStatut.filter((x) => x.statut === "perime").length;
  const nbBientot = epiAvecStatut.filter((x) => x.statut === "bientot").length;

  return (
    <div className="mx-auto grid max-w-3xl gap-8 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Groupe électrogène</h1>

      <section className="grid gap-3" aria-labelledby="titre-essai">
        <h2 id="titre-essai" className="text-lg font-semibold">
          Essai en charge mensuel
        </h2>
        {plans.length === 0 ? (
          <div className="grid gap-3 rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Aucun suivi en place. Jalon crée un contrôle « {TYPE_ESSAI} » tous les mois et vous rappelle chaque
              échéance par mail et dans « Aujourd&apos;hui ».
            </p>
            {peutEcrire ? (
              <FormulaireEssai equipements={options.equipements} libelle="Mettre en place le suivi" />
            ) : (
              <p className="text-sm">Un technicien ou un administrateur peut le mettre en place.</p>
            )}
          </div>
        ) : (
          <>
            <ul className="grid gap-2">
              {plans.map((p) => (
                <li key={p.plan_controle_id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                  <Link href={`/controles/plans/${p.plan_controle_id}`} className="grid min-w-0 flex-1 gap-1">
                    <span className="font-medium">
                      {p.equipement_code ? `${p.equipement_code} — ` : ""}
                      {p.perimetre}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <BadgeStatut statut={p.statut_echeance} />
                      <span className="text-muted-foreground">
                        {p.dernier_controle
                          ? `Dernier essai le ${formaterDate(p.dernier_controle)}`
                          : "Jamais effectué"}
                        {p.prochaine_echeance && ` · prochain avant le ${formaterDate(p.prochaine_echeance)}`}
                      </span>
                    </span>
                  </Link>
                  {peutEcrire && (
                    <LienBouton
                      href={`/controles/saisie?plan=${p.plan_controle_id}&retour=/groupe-electrogene`}
                      className="h-12 shrink-0"
                    >
                      <ClipboardPlus className="size-4" aria-hidden />
                      Essai effectué
                    </LienBouton>
                  )}
                </li>
              ))}
            </ul>

            {essais.length > 0 && (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">Derniers essais</h3>
                <ol className="grid gap-1.5">
                  {essais.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/controles/plans/${e.plan_controle_id}`}
                        className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50"
                      >
                        <span>
                          <span className="font-medium">{formaterDate(e.date_realisation)}</span>
                          {plans.length > 1 && ` · ${e.perimetre}`}
                          {e.commentaire && <span className="text-muted-foreground"> · {e.commentaire}</span>}
                        </span>
                        <span>{LIBELLES_RESULTAT[e.resultat]}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {peutEcrire && (
              <details className="rounded-lg border border-dashed p-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
                  Suivre un autre groupe électrogène
                </summary>
                <div className="pt-3">
                  <FormulaireEssai equipements={options.equipements} libelle="Ajouter le suivi" />
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="titre-epi">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="titre-epi" className="text-lg font-semibold">
            EPI ({epi.length})
          </h2>
          {peutEcrire && (
            <LienBouton href="/groupe-electrogene/epi/nouveau" variante="outline">
              <Plus className="size-4" aria-hidden />
              Ajouter un EPI
            </LienBouton>
          )}
        </div>
        {(nbPerimes > 0 || nbBientot > 0) && (
          <p
            role="status"
            className={cn(
              "rounded-md p-3 text-sm",
              nbPerimes > 0 ? "bg-red-600/10 text-red-800 dark:text-red-300" : "bg-amber-400/20",
            )}
          >
            {[
              nbPerimes > 0 && `${nbPerimes} EPI périmé${nbPerimes > 1 ? "s" : ""}`,
              nbBientot > 0 && `${nbBientot} à remplacer dans les ${seuil} jours`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {epi.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun EPI suivi. Ajoutez vos gants, casques, lunettes… avec leur date de péremption : Jalon vous prévient
            avant l&apos;échéance.
          </p>
        ) : (
          <ul className="grid gap-2">
            {epiAvecStatut.map((x) => {
              const jours = x.date_peremption ? joursAvantPeremption(x.date_peremption, aujourdhui) : null;
              return (
                <li key={x.id}>
                  <Link
                    href={peutEcrire ? `/groupe-electrogene/epi/${x.id}` : "#"}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50"
                    aria-disabled={!peutEcrire}
                  >
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="font-medium">
                        {x.libelle}
                        {x.quantite > 1 && <span className="text-muted-foreground"> × {x.quantite}</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline" className={STYLE_EPI[x.statut]}>
                          {LIBELLES_STATUT_EPI[x.statut]}
                        </Badge>
                        {x.date_peremption && (
                          <span className="text-muted-foreground">
                            {jours !== null && jours < 0
                              ? `périmé depuis le ${formaterDate(x.date_peremption)}`
                              : `valable jusqu'au ${formaterDate(x.date_peremption)}`}
                          </span>
                        )}
                        {[x.detail, x.localisation].filter(Boolean).length > 0 && (
                          <span className="text-muted-foreground">
                            · {[x.detail, x.localisation].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </span>
                    {peutEcrire && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
