import Link from "next/link";
import type { ReactNode } from "react";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowRight,
  CircleCheck,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  ListTodo,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import { messageAlerteContrat } from "@/components/alerte-contrat";
import { BadgeReserves } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { lireEnvRappels } from "@/lib/env";
import { jalonDuJour, regroupements, type JalonDuJour, type Regroupement } from "@/lib/metier/aujourdhui";
import { formaterDate, LIBELLES_GRAVITE } from "@/lib/format";
import { alerteContrat, type AlerteContrat } from "@/lib/metier/contrats";
import { aujourdhuiParis, FUSEAU } from "@/lib/metier/echeance";
import { LIBELLES_STATUT_CHANTIER, LIBELLES_STATUT_INTERVENTION } from "@/lib/metier/interventions";
import {
  depuisJours,
  interventionEnRetard,
  messageRetardChantier,
  retardChantier,
  type RetardChantier,
} from "@/lib/metier/retards";
import {
  donneesAujourdhui,
  type ChantierSuivi,
  type ContratSuivi,
  type InterventionOuverte,
  type ReserveOuverte,
} from "@/lib/requetes/aujourdhui";
import type { PlanEcheance } from "@/lib/requetes/controles";
import { messageSauvegarde } from "@/lib/metier/sauvegarde";
import { etatSauvegarde } from "@/lib/requetes/sauvegarde-etat";
import { formaterValeur, libelleSeuils, LIBELLES_STATUT_RELEVE } from "@/lib/metier/releves";
import { avecEtat, type PointAvecEtat } from "@/lib/requetes/releves";
import { verifications } from "@/lib/requetes/verifications";
import { retardTache } from "@/lib/metier/taches";
import { tachesOuvertes } from "@/lib/requetes/taches";
import { formationsActuelles } from "@/lib/requetes/formations";
import { joursAvantEcheance, statutFormation } from "@/lib/metier/formations";
import { BoutonResoudre } from "./taches/bouton-tache";
import { cn } from "@/lib/utils";

export const metadata = { title: "Aujourd'hui — Jalon" };

const TON = {
  rouge: "border-l-red-600",
  violet: "border-l-violet-600",
  ambre: "border-l-amber-400",
  neutre: "border-l-border",
} as const;

const THEMES = {
  taches: {
    icone: ListTodo,
    cadre: "border-sky-600/40 bg-sky-600/[0.04]",
    entete: "bg-sky-600/10 text-sky-900 dark:text-sky-200",
    puce: "bg-sky-600 text-white",
  },
  controles: {
    icone: ClipboardCheck,
    cadre: "border-emerald-600/40 bg-emerald-600/[0.04]",
    entete: "bg-emerald-600/10 text-emerald-900 dark:text-emerald-200",
    puce: "bg-emerald-600 text-white",
  },
  interventions: {
    icone: Wrench,
    cadre: "border-orange-600/40 bg-orange-600/[0.04]",
    entete: "bg-orange-600/10 text-orange-900 dark:text-orange-200",
    puce: "bg-orange-600 text-white",
  },
  releves: {
    icone: Gauge,
    cadre: "border-cyan-600/40 bg-cyan-600/[0.04]",
    entete: "bg-cyan-600/10 text-cyan-900 dark:text-cyan-200",
    puce: "bg-cyan-700 text-white",
  },
  reserves: {
    icone: ShieldAlert,
    cadre: "border-violet-600/40 bg-violet-600/[0.04]",
    entete: "bg-violet-600/10 text-violet-900 dark:text-violet-200",
    puce: "bg-violet-600 text-white",
  },
  formations: {
    icone: GraduationCap,
    cadre: "border-rose-600/40 bg-rose-600/[0.04]",
    entete: "bg-rose-600/10 text-rose-900 dark:text-rose-200",
    puce: "bg-rose-600 text-white",
  },
} as const;

/** Encart d'un thème : en-tête coloré (icône, titre, compteur), contenu dessous. Masqué si vide, sauf `toujours`. */
function Groupe({
  theme,
  titre,
  nombre,
  toujours = false,
  action,
  children,
}: {
  theme: keyof typeof THEMES;
  titre: string;
  nombre: number;
  toujours?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  if (nombre === 0 && !toujours) return null;
  const t = THEMES[theme];
  const Icone = t.icone;
  return (
    <section aria-label={titre} className={cn("grid gap-4 overflow-hidden rounded-xl border pb-4", t.cadre)}>
      <div className={cn("flex items-center justify-between gap-3 px-4 py-3", t.entete)}>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Icone className="size-5" aria-hidden />
          {titre}
          <span className={cn("rounded-full px-2 py-0.5 text-sm font-medium tabular-nums", t.puce)}>{nombre}</span>
        </h2>
        {action}
      </div>
      <div className="grid gap-4 px-4">{children}</div>
    </section>
  );
}

function Section({
  titre,
  nombre,
  ton,
  replie = false,
  children,
}: {
  titre: string;
  nombre: number;
  ton: keyof typeof TON;
  /** Liste longue et secondaire : repliée par défaut. */
  replie?: boolean;
  children: ReactNode;
}) {
  if (nombre === 0) return null;
  const liste = <ul className={cn("grid gap-2 border-l-4 pl-3", TON[ton])}>{children}</ul>;
  if (replie) {
    return (
      <details className="rounded-lg border p-3">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">
          {titre} <span className="text-sm font-normal text-muted-foreground">{nombre} · afficher</span>
        </summary>
        <div className="pt-2">{liste}</div>
      </details>
    );
  }
  return (
    <section className="grid gap-2">
      <h3 className="flex items-baseline gap-2 text-base font-semibold">
        {titre}
        <span className="text-sm font-normal text-muted-foreground">{nombre}</span>
      </h3>
      {liste}
    </section>
  );
}

function LignePlan({ plan, detail, peutEcrire }: { plan: PlanEcheance; detail: string; peutEcrire: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Link href={`/controles/plans/${plan.plan_controle_id}`} className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{plan.type_libelle}</span>
        <span className="truncate text-sm text-muted-foreground">
          {[plan.equipement_code, plan.perimetre].filter(Boolean).join(" — ")}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {detail}
          <BadgeReserves ouvertes={plan.nb_reserves_ouvertes} />
        </span>
      </Link>
      {peutEcrire && (
        <LienBouton href={`/controles/saisie?plan=${plan.plan_controle_id}`} className="h-11 shrink-0">
          Effectué
        </LienBouton>
      )}
    </li>
  );
}

function LigneReserve({ reserve, aujourdhui }: { reserve: ReserveOuverte; aujourdhui: string }) {
  const depassee = reserve.echeance_levee !== null && reserve.echeance_levee < aujourdhui;
  return (
    <li>
      <Link
        href={`/controles/plans/${reserve.plan_controle_id}`}
        className="grid gap-0.5 rounded-lg border bg-card p-3"
      >
        <span className="font-medium">{reserve.description}</span>
        <span className="text-sm text-muted-foreground">
          {reserve.type_libelle}
          {reserve.perimetre && ` — ${reserve.perimetre}`}
        </span>
        <span className={cn("text-sm", depassee && "font-medium text-destructive")}>
          {reserve.gravite ? LIBELLES_GRAVITE[reserve.gravite] : "Gravité à préciser"}
          {reserve.echeance_levee
            ? ` · à lever avant le ${formaterDate(reserve.echeance_levee)}`
            : " · sans échéance de levée"}
        </span>
      </Link>
    </li>
  );
}

/** Une seule action recommandée, avec sa raison (règle d'ordre explicite, voir metier/aujourdhui). */
function CarteJalon({ jalon }: { jalon: JalonDuJour }) {
  return (
    <section aria-labelledby="jalon-du-jour" className="grid gap-3 rounded-lg border-2 border-primary/70 bg-card p-4">
      <p id="jalon-du-jour" className="surtitre">
        Jalon du jour · par où commencer
      </p>
      <div className="grid gap-0.5">
        <p className="text-lg font-semibold">{jalon.titre}</p>
        <p className="text-sm text-muted-foreground">{jalon.detail}</p>
      </div>
      <p className="text-sm">
        <span className="font-medium">Pourquoi celle-ci : </span>
        {jalon.pourquoi}
      </p>
      <LienBouton href={jalon.lien} className="h-12 w-full text-base sm:w-fit">
        {jalon.action ?? "Ouvrir"}
        <ArrowRight className="size-4" aria-hidden />
      </LienBouton>
    </section>
  );
}

function ListeRegroupements({ groupes }: { groupes: Regroupement[] }) {
  return (
    <section className="grid gap-2">
      <h3 className="flex items-baseline gap-2 text-base font-semibold">
        Une seule visite ?<span className="text-sm font-normal text-muted-foreground">{groupes.length}</span>
      </h3>
      <p className="text-sm text-muted-foreground">
        Plusieurs contrôles du même prestataire tombent dans la même période : à grouper en une intervention.
      </p>
      <ul className="grid gap-2">
        {groupes.map((g) => (
          <li key={g.prestataire_id} className="grid gap-1 rounded-lg border bg-card p-3">
            <Link href={`/prestataires/${g.prestataire_id}`} className="flex items-center gap-2 font-medium underline">
              <Users className="size-4" aria-hidden />
              {g.prestataire_nom} · {g.plans.length} contrôles
            </Link>
            <span className="text-sm text-muted-foreground">
              {g.du === g.au
                ? `Échéance le ${formaterDate(g.du)}`
                : `Échéances du ${formaterDate(g.du)} au ${formaterDate(g.au)}`}
            </span>
            <ul className="grid gap-0.5 text-sm">
              {g.plans.map((p) => (
                <li key={p.plan_controle_id}>
                  <Link href={`/controles/plans/${p.plan_controle_id}`} className="underline-offset-2 hover:underline">
                    {p.type_libelle}
                    {p.perimetre && ` — ${p.perimetre}`} · {formaterDate(p.echeance)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Raison pour laquelle les rappels mail ne partiront pas (admin), ou null. */
function rappelsInactifs(destinataires: number): string | null {
  try {
    lireEnvRappels();
  } catch {
    return "Rappels mail inactifs : la configuration d'envoi est incomplète.";
  }
  return destinataires === 0 ? "Rappels mail inactifs : aucun destinataire n'est renseigné." : null;
}

function LigneIntervention({ i, aujourdhui }: { i: InterventionOuverte; aujourdhui: string }) {
  const enRetard = interventionEnRetard(i, aujourdhui);
  return (
    <li>
      <Link href={`/interventions/${i.id}`} className="grid gap-0.5 rounded-lg border bg-card p-3">
        <span className="font-medium">{i.titre}</span>
        <span className="text-sm text-muted-foreground">
          {[i.equipement_code, LIBELLES_STATUT_INTERVENTION[i.statut], i.assignee_nom].filter(Boolean).join(" · ")}
        </span>
        {i.date_prevue && (
          <span className={cn("text-sm", enRetard && "font-medium text-destructive")}>
            Prévue le {formaterDate(i.date_prevue)}
            {enRetard && ` (${depuisJours(i.date_prevue, aujourdhui)})`}
          </span>
        )}
      </Link>
    </li>
  );
}

function LigneReleve({ p }: { p: PointAvecEtat }) {
  const seuils = libelleSeuils(p.seuil_min, p.seuil_max, p.unite);
  return (
    <li>
      <Link href={`/releves/${p.id}`} className="grid gap-0.5 rounded-lg border bg-card p-3">
        <span className="font-medium">{p.libelle}</span>
        <span className="text-sm text-muted-foreground">
          {[p.equipement_code, p.localisation].filter(Boolean).join(" · ") || "Relevé périodique"}
        </span>
        {p.hors_seuil && p.derniere_valeur !== null ? (
          <span className="text-sm font-medium text-destructive">
            {formaterValeur(p.derniere_valeur, p.unite)} {p.hors_seuil === "bas" ? "sous" : "au-dessus de"} la limite
            {seuils && ` (${seuils})`}
          </span>
        ) : (
          <span className="text-sm">{LIBELLES_STATUT_RELEVE[p.statut]}</span>
        )}
      </Link>
    </li>
  );
}

export default async function PageAujourdhui() {
  const aujourdhui = aujourdhuiParis();
  const {
    utilisateur,
    plans,
    reserves,
    interventions: ouvertes,
    chantiers,
    points,
    contrats,
    seuilJours,
    destinataires,
    aVerifier,
    taches,
    formations,
    sauvegarde,
  } = await requete(async (tx, u) => {
    const donnees = await donneesAujourdhui(tx);
    return {
      utilisateur: u,
      ...donnees,
      aVerifier: await verifications(tx, donnees.plans),
      taches: await tachesOuvertes(tx),
      formations: await formationsActuelles(tx),
      sauvegarde: u.role === "admin" ? await etatSauvegarde(tx, aujourdhui) : null,
    };
  });
  const peutEcrire = utilisateur.role !== "lecture";

  const parStatut = (s: PlanEcheance["statut_echeance"]) => plans.filter((p) => p.statut_echeance === s);
  const enRetard = parStatut("en_retard");
  const jamais = parStatut("jamais_controle");
  const aEcheance = parStatut("a_echeance");
  const reservesDepassees = reserves.filter((r) => r.echeance_levee !== null && r.echeance_levee < aujourdhui);
  const autresReserves = reserves.filter((r) => !reservesDepassees.includes(r));
  const contratsAlerte = contrats
    .map((c) => ({ contrat: c, alerte: alerteContrat(c, aujourdhui, seuilJours) }))
    .filter((x): x is { contrat: ContratSuivi; alerte: AlerteContrat } => x.alerte !== null);

  const interventions = ouvertes.filter((i) => i.priorite === "urgente");
  const interventionsEnRetard = ouvertes.filter((i) => i.priorite !== "urgente" && interventionEnRetard(i, aujourdhui));
  const chantiersEnRetard = chantiers
    .map((c) => ({ chantier: c, retard: retardChantier(c, aujourdhui) }))
    .filter((x): x is { chantier: ChantierSuivi; retard: RetardChantier } => x.retard !== null);

  const tachesEnRetard = taches.filter((t) => retardTache(t.echeance, aujourdhui) !== null);
  const formationsAlerte = formations
    .map((f) => ({ formation: f, statut: statutFormation(f.echeance, aujourdhui, seuilJours) }))
    .filter((x) => x.statut === "expiree" || x.statut === "bientot");

  const relevesEtat = points.map((p) => avecEtat(p, aujourdhui));
  const relevesHorsSeuil = relevesEtat.filter((p) => p.hors_seuil !== null);
  const relevesEnAttente = relevesEtat.filter((p) => p.statut !== "a_jour");

  const aTraiter =
    relevesEnAttente.length +
    relevesHorsSeuil.length +
    enRetard.length +
    jamais.length +
    aEcheance.length +
    reserves.length +
    interventions.length +
    interventionsEnRetard.length +
    chantiersEnRetard.length +
    contratsAlerte.length +
    tachesEnRetard.length +
    formationsAlerte.length;
  const rienDUrgent = aTraiter === 0;
  const jalon = jalonDuJour({ aujourdhui, plans, reserves, interventions, contrats: contratsAlerte });
  const groupes = regroupements(plans, aujourdhui, seuilJours);
  const nbAVerifier = aVerifier.reduce((n, c) => n + c.elements.length, 0);
  const alerteSauvegarde = sauvegarde ? messageSauvegarde(sauvegarde) : null;
  const alerteRappels = utilisateur.role === "admin" ? rappelsInactifs(destinataires) : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <header className="grid gap-3">
        <p className="surtitre">{formatInTimeZone(new Date(), FUSEAU, "EEEE d MMMM yyyy", { locale: fr })}</p>
        <h1 className="text-3xl md:text-4xl">Bonjour {utilisateur.nom.split(" ")[0]}</h1>
        {!rienDUrgent && (
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{aTraiter}</span>{" "}
            {aTraiter > 1 ? "points demandent" : "point demande"} votre attention, du plus urgent au moins urgent.
          </p>
        )}
      </header>

      {alerteSauvegarde && (
        <p role="alert" className="rounded-md bg-amber-400/20 p-3 text-sm">
          {alerteSauvegarde}{" "}
          <Link href="/parametres" className="font-medium underline">
            Télécharger une sauvegarde
          </Link>
        </p>
      )}

      {alerteRappels && (
        <p role="alert" className="rounded-md bg-amber-400/20 p-3 text-sm">
          {alerteRappels}{" "}
          <Link href="/parametres" className="font-medium underline">
            Paramètres
          </Link>
        </p>
      )}

      {jalon && <CarteJalon jalon={jalon} />}

      {rienDUrgent && (
        <p className="flex items-center gap-3 rounded-lg border bg-card p-6 text-lg">
          <CircleCheck className="size-6 text-emerald-600" aria-hidden />
          Rien à signaler aujourd&apos;hui.
        </p>
      )}

      <Groupe
        theme="taches"
        titre="Tâches en cours"
        nombre={taches.length}
        toujours
        action={
          <Link href="/taches" className="text-sm font-medium underline">
            {peutEcrire ? "Ajouter / voir tout" : "Voir tout"}
          </Link>
        }
      >
        {taches.length === 0 && <p className="text-sm text-muted-foreground">Aucune tâche en cours.</p>}
        {taches.length > 0 && (
          <ul className="grid gap-2">
            {taches.map((t) => {
              const retard = retardTache(t.echeance, aujourdhui);
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-medium">{t.libelle}</span>
                    {t.echeance && (
                      <span className={cn("text-sm text-muted-foreground", retard && "font-medium text-destructive")}>
                        Pour le {formaterDate(t.echeance)}
                        {retard && ` · en retard de ${retard} j`}
                      </span>
                    )}
                  </span>
                  {peutEcrire && <BoutonResoudre id={t.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </Groupe>

      <Groupe theme="formations" titre="Formations à renouveler" nombre={formationsAlerte.length}>
        <ul className="grid gap-2">
          {formationsAlerte.map(({ formation: f, statut }) => (
            <li key={f.id}>
              <Link href={`/formations/${f.id}`} className="grid gap-0.5 rounded-lg border bg-card p-3">
                <span className="font-medium">
                  {f.agent_nom} · {f.type_libelle}
                </span>
                <span className={cn("text-sm", statut === "expiree" && "font-medium text-destructive")}>
                  {statut === "expiree"
                    ? `Expirée depuis le ${formaterDate(f.echeance)}`
                    : `Échéance le ${formaterDate(f.echeance)} (dans ${joursAvantEcheance(f.echeance!, aujourdhui)} j)`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Groupe>

      <Groupe theme="controles" titre="Contrôles" nombre={enRetard.length + jamais.length + aEcheance.length}>
        <Section titre="Contrôles en retard" nombre={enRetard.length} ton="rouge">
          {enRetard.map((p) => (
            <LignePlan
              key={p.plan_controle_id}
              plan={p}
              peutEcrire={peutEcrire}
              detail={`Échéance dépassée le ${formaterDate(p.prochaine_echeance)}`}
            />
          ))}
        </Section>

        <Section titre="Jamais contrôlés" nombre={jamais.length} ton="violet">
          {jamais.map((p) => (
            <LignePlan
              key={p.plan_controle_id}
              plan={p}
              peutEcrire={peutEcrire}
              detail="Saisir le dernier contrôle connu"
            />
          ))}
        </Section>

        <Section titre={`Échéances à ${seuilJours} jours`} nombre={aEcheance.length} ton="ambre">
          {aEcheance.map((p) => (
            <LignePlan
              key={p.plan_controle_id}
              plan={p}
              peutEcrire={peutEcrire}
              detail={`Échéance le ${formaterDate(p.prochaine_echeance)}`}
            />
          ))}
        </Section>

        {groupes.length > 0 && <ListeRegroupements groupes={groupes} />}
      </Groupe>

      <Groupe
        theme="interventions"
        titre="Interventions et chantiers"
        nombre={interventions.length + interventionsEnRetard.length + chantiersEnRetard.length}
      >
        <Section titre="Interventions urgentes" nombre={interventions.length} ton="rouge">
          {interventions.map((i) => (
            <LigneIntervention key={i.id} i={i} aujourdhui={aujourdhui} />
          ))}
        </Section>

        <Section titre="Interventions en retard" nombre={interventionsEnRetard.length} ton="rouge">
          {interventionsEnRetard.map((i) => (
            <LigneIntervention key={i.id} i={i} aujourdhui={aujourdhui} />
          ))}
        </Section>

        <Section titre="Chantiers en retard" nombre={chantiersEnRetard.length} ton="ambre">
          {chantiersEnRetard.map(({ chantier: c, retard }) => (
            <li key={c.id}>
              <Link href={`/chantiers/${c.id}`} className="grid gap-0.5 rounded-lg border bg-card p-3">
                <span className="font-medium">{c.titre}</span>
                <span className="text-sm text-muted-foreground">
                  {[LIBELLES_STATUT_CHANTIER[c.statut], c.responsable_nom].filter(Boolean).join(" · ")}
                </span>
                <span className="text-sm font-medium text-destructive">
                  {messageRetardChantier(c, retard, aujourdhui)}
                </span>
              </Link>
            </li>
          ))}
        </Section>
      </Groupe>

      <Groupe theme="releves" titre="Relevés" nombre={relevesHorsSeuil.length + relevesEnAttente.length}>
        <Section titre="Valeurs hors seuil" nombre={relevesHorsSeuil.length} ton="rouge">
          {relevesHorsSeuil.map((p) => (
            <LigneReleve key={p.id} p={p} />
          ))}
        </Section>

        <Section titre="Relevés à faire" nombre={relevesEnAttente.length} ton="ambre">
          {relevesEnAttente.map((p) => (
            <LigneReleve key={p.id} p={p} />
          ))}
        </Section>
      </Groupe>

      <Groupe
        theme="reserves"
        titre="Réserves et contrats"
        nombre={reservesDepassees.length + contratsAlerte.length + autresReserves.length}
      >
        <Section titre="Réserves à lever en retard" nombre={reservesDepassees.length} ton="rouge">
          {reservesDepassees.map((r) => (
            <LigneReserve key={r.id} reserve={r} aujourdhui={aujourdhui} />
          ))}
        </Section>

        <Section titre="Contrats : décision à prendre" nombre={contratsAlerte.length} ton="ambre">
          {contratsAlerte.map(({ contrat: c, alerte }) => (
            <li key={c.id}>
              <Link href={`/contrats/${c.id}`} className="grid gap-0.5 rounded-lg border bg-card p-3">
                <span className="font-medium">{c.objet}</span>
                <span className="text-sm text-muted-foreground">{c.prestataire_nom}</span>
                <span className={cn("text-sm", alerte !== "a_decider" && "font-medium text-destructive")}>
                  {messageAlerteContrat(c, alerte)}
                </span>
              </Link>
            </li>
          ))}
        </Section>

        <Section titre="Autres réserves ouvertes" nombre={autresReserves.length} ton="neutre" replie>
          {autresReserves.map((r) => (
            <LigneReserve key={r.id} reserve={r} aujourdhui={aujourdhui} />
          ))}
        </Section>
      </Groupe>

      {nbAVerifier > 0 && (
        <Link
          href="/verifications"
          className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4"
        >
          <span>
            <span className="font-medium">
              {nbAVerifier} point{nbAVerifier > 1 ? "s" : ""} à vérifier dans le suivi
            </span>
            <span className="block text-sm text-muted-foreground">
              Saisies incomplètes qui peuvent cacher un oubli : {aVerifier.map((c) => c.titre.toLowerCase()).join(", ")}
              .
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </div>
  );
}
