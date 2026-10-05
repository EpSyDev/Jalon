import Link from "next/link";
import type { ReactNode } from "react";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { CircleCheck } from "lucide-react";
import { messageAlerteContrat } from "@/components/alerte-contrat";
import { BadgeReserves } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_GRAVITE } from "@/lib/format";
import { alerteContrat, type AlerteContrat } from "@/lib/metier/contrats";
import { aujourdhuiParis, FUSEAU } from "@/lib/metier/echeance";
import { donneesAujourdhui, type ContratSuivi, type ReserveOuverte } from "@/lib/requetes/aujourdhui";
import type { PlanEcheance } from "@/lib/requetes/controles";
import { cn } from "@/lib/utils";

export const metadata = { title: "Aujourd'hui — Jalon" };

const TON = {
  rouge: "border-l-red-600",
  violet: "border-l-violet-600",
  ambre: "border-l-amber-400",
  neutre: "border-l-border",
} as const;

function Section({
  titre,
  nombre,
  ton,
  children,
}: {
  titre: string;
  nombre: number;
  ton: keyof typeof TON;
  children: ReactNode;
}) {
  if (nombre === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="flex items-baseline gap-2 text-lg font-semibold">
        {titre}
        <span className="text-sm font-normal text-muted-foreground">{nombre}</span>
      </h2>
      <ul className={cn("grid gap-2 border-l-4 pl-3", TON[ton])}>{children}</ul>
    </section>
  );
}

function LignePlan({ plan, detail, peutEcrire }: { plan: PlanEcheance; detail: string; peutEcrire: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
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
          Fait
        </LienBouton>
      )}
    </li>
  );
}

function LigneReserve({ reserve, aujourdhui }: { reserve: ReserveOuverte; aujourdhui: string }) {
  const depassee = reserve.echeance_levee !== null && reserve.echeance_levee < aujourdhui;
  return (
    <li>
      <Link href={`/controles/plans/${reserve.plan_controle_id}`} className="grid gap-0.5 rounded-lg border p-3">
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

export default async function PageAujourdhui() {
  const aujourdhui = aujourdhuiParis();
  const { utilisateur, plans, reserves, interventions, contrats, seuilJours } = await requete(async (tx, u) => ({
    utilisateur: u,
    ...(await donneesAujourdhui(tx)),
  }));
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

  const rienDUrgent =
    enRetard.length +
      jamais.length +
      aEcheance.length +
      reserves.length +
      interventions.length +
      contratsAlerte.length ===
    0;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour {utilisateur.nom}</h1>
        <p className="text-muted-foreground first-letter:uppercase">
          {formatInTimeZone(new Date(), FUSEAU, "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {rienDUrgent && (
        <p className="flex items-center gap-3 rounded-lg border p-6 text-lg">
          <CircleCheck className="size-6 text-emerald-600" aria-hidden />
          Rien à signaler aujourd&apos;hui.
        </p>
      )}

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

      <Section titre="Interventions urgentes" nombre={interventions.length} ton="rouge">
        {interventions.map((i) => (
          <li key={i.id}>
            <Link href={`/interventions/${i.id}`} className="grid gap-0.5 rounded-lg border p-3">
              <span className="font-medium">{i.titre}</span>
              <span className="text-sm text-muted-foreground">
                {[
                  i.equipement_code,
                  { a_faire: "À faire", en_cours: "En cours", en_attente: "En attente" }[i.statut],
                  i.assignee_nom,
                  i.date_prevue && `prévue le ${formaterDate(i.date_prevue)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </Section>

      <Section titre="Réserves à lever en retard" nombre={reservesDepassees.length} ton="rouge">
        {reservesDepassees.map((r) => (
          <LigneReserve key={r.id} reserve={r} aujourdhui={aujourdhui} />
        ))}
      </Section>

      <Section titre="Contrats : décision à prendre" nombre={contratsAlerte.length} ton="ambre">
        {contratsAlerte.map(({ contrat: c, alerte }) => (
          <li key={c.id}>
            <Link href={`/contrats/${c.id}`} className="grid gap-0.5 rounded-lg border p-3">
              <span className="font-medium">{c.objet}</span>
              <span className="text-sm text-muted-foreground">{c.prestataire_nom}</span>
              <span className={cn("text-sm", alerte !== "a_decider" && "font-medium text-destructive")}>
                {messageAlerteContrat(c, alerte)}
              </span>
            </Link>
          </li>
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

      <Section titre="Autres réserves ouvertes" nombre={autresReserves.length} ton="neutre">
        {autresReserves.map((r) => (
          <LigneReserve key={r.id} reserve={r} aujourdhui={aujourdhui} />
        ))}
      </Section>
    </div>
  );
}
