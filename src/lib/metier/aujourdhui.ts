// Écran « Aujourd'hui » : une action recommandée (règle d'ordre explicite, jamais de score) et les contrôles
// d'un même prestataire à grouper en une visite. Fonctions pures, testées.

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { AlerteContrat } from "./contrats";
import { limitePreavis } from "./contrats";
import type { StatutEcheance } from "./echeance";

type Caractere = "reglementaire" | "obligatoire" | "interne";

export type PlanJour = {
  plan_controle_id: string;
  type_libelle: string;
  caractere: Caractere;
  statut_echeance: StatutEcheance;
  prochaine_echeance: string | null;
  equipement_code: string | null;
  perimetre: string | null;
  prestataire_id: string | null;
  prestataire_nom: string | null;
};

export type EntreeJalon = {
  aujourdhui: string;
  plans: PlanJour[];
  reserves: {
    id: string;
    gravite: "mineure" | "majeure" | "critique" | null;
    echeance_levee: string | null;
    plan_controle_id: string;
    type_libelle: string;
  }[];
  interventions: { id: string; titre: string; date_demande: string }[];
  contrats: {
    contrat: { id: string; objet: string; prestataire_nom: string; date_fin: string; preavis_jours: number | null };
    alerte: AlerteContrat;
  }[];
};

export type JalonDuJour = { titre: string; detail: string; pourquoi: string; lien: string; action?: string };

/** Fenêtre au-delà de laquelle un préavis de contrat ne passe plus avant les contrôles en retard. */
export const PREAVIS_PRIORITAIRE_JOURS = 14;

const fr = (iso: string) => iso.split("-").reverse().join("/");
const jours = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;
const ecart = (de: string, a: string) => differenceInCalendarDays(parseISO(a), parseISO(de));
const ORDRE_CARACTERE: Caractere[] = ["reglementaire", "obligatoire", "interne"];
const LIBELLE_CARACTERE = { reglementaire: "réglementaire", obligatoire: "obligatoire", interne: "interne" } as const;

const perimetreDe = (p: PlanJour) => [p.equipement_code, p.perimetre].filter(Boolean).join(" — ");

/** Le plus petit élément selon la clé (stable : à égalité, le premier). */
function premier<T>(liste: T[], cle: (x: T) => string): T | undefined {
  return liste.reduce<T | undefined>((m, x) => (m === undefined || cle(x) < cle(m) ? x : m), undefined);
}

/**
 * Une seule action recommandée, choisie par un ordre de priorité explicite (affiché à l'utilisateur) :
 * 1. préavis de contrat à donner dans les 14 jours (une date qui ne se rattrape pas) ;
 * 2. contrôle en retard, réglementaire d'abord, puis obligatoire, puis interne : le plus ancien ;
 * 3. réserve critique dont l'échéance de levée est dépassée : la plus ancienne ;
 * 4. intervention urgente non terminée : la plus ancienne demande ;
 * 5. plan jamais contrôlé, réglementaire d'abord ;
 * 6. préavis de contrat plus lointain ;
 * 7. échéance la plus proche.
 */
export function jalonDuJour(e: EntreeJalon): JalonDuJour | null {
  const preavis = e.contrats
    .filter((c) => c.alerte === "a_decider")
    .map((c) => ({ ...c, limite: limitePreavis(c.contrat.date_fin, c.contrat.preavis_jours) }));
  const preavisProche = premier(
    preavis.filter((c) => ecart(e.aujourdhui, c.limite) <= PREAVIS_PRIORITAIRE_JOURS),
    (c) => c.limite,
  );
  const versContrat = (c: (typeof preavis)[number], raison: string): JalonDuJour => {
    const n = ecart(e.aujourdhui, c.limite);
    return {
      titre: c.contrat.objet,
      detail: `${c.contrat.prestataire_nom} · préavis à donner avant le ${fr(c.limite)}`,
      pourquoi: `${n === 0 ? "C'est le dernier jour" : `Plus que ${jours(n)}`} pour dénoncer ou renégocier ce contrat ${raison}.`,
      lien: `/contrats/${c.contrat.id}`,
      action: "Voir le contrat",
    };
  };
  if (preavisProche)
    return versContrat(preavisProche, ": passé cette date, il se poursuit ou s'arrête sans votre décision");

  for (const caractere of ORDRE_CARACTERE) {
    const retard = premier(
      e.plans.filter((p) => p.statut_echeance === "en_retard" && p.caractere === caractere && p.prochaine_echeance),
      (p) => p.prochaine_echeance!,
    );
    if (retard) {
      const n = ecart(retard.prochaine_echeance!, e.aujourdhui);
      const autres = e.plans.filter((p) => p.statut_echeance === "en_retard").length - 1;
      return {
        titre: retard.type_libelle,
        detail: perimetreDe(retard) || "Contrôle en retard",
        pourquoi: `Contrôle ${LIBELLE_CARACTERE[caractere]} en retard depuis ${jours(n)} (échéance du ${fr(retard.prochaine_echeance!)}) : le plus ancien${caractere === "reglementaire" ? " des retards réglementaires" : ""}${autres > 0 ? `, sur ${autres + 1} retards` : ""}.`,
        lien: `/controles/plans/${retard.plan_controle_id}`,
        action: "Saisir le contrôle",
      };
    }
  }

  const critique = premier(
    e.reserves.filter((r) => r.gravite === "critique" && r.echeance_levee && r.echeance_levee < e.aujourdhui),
    (r) => r.echeance_levee!,
  );
  if (critique) {
    return {
      titre: `Réserve critique — ${critique.type_libelle}`,
      detail: `À lever avant le ${fr(critique.echeance_levee!)}`,
      pourquoi: `Réserve classée critique, échéance de levée dépassée de ${jours(ecart(critique.echeance_levee!, e.aujourdhui))}.`,
      lien: `/controles/plans/${critique.plan_controle_id}`,
      action: "Voir la réserve",
    };
  }

  const urgente = premier(e.interventions, (i) => i.date_demande);
  if (urgente) {
    return {
      titre: urgente.titre,
      detail: `Demandée le ${fr(urgente.date_demande)}`,
      pourquoi: `Intervention urgente non terminée, la plus ancienne (${jours(ecart(urgente.date_demande, e.aujourdhui))}).`,
      lien: `/interventions/${urgente.id}`,
      action: "Voir l'intervention",
    };
  }

  for (const caractere of ORDRE_CARACTERE) {
    const jamais = e.plans.find((p) => p.statut_echeance === "jamais_controle" && p.caractere === caractere);
    if (jamais) {
      const n = e.plans.filter((p) => p.statut_echeance === "jamais_controle").length;
      return {
        titre: jamais.type_libelle,
        detail: perimetreDe(jamais) || "Jamais contrôlé",
        pourquoi: `Aucun contrôle enregistré : sans le dernier contrôle connu, Jalon ne peut pas calculer l'échéance${n > 1 ? ` (${n} plans dans ce cas)` : ""}.`,
        lien: `/controles/saisie?plan=${jamais.plan_controle_id}`,
        action: "Saisir le dernier contrôle",
      };
    }
  }

  const preavisLoin = premier(preavis, (c) => c.limite);
  if (preavisLoin) return versContrat(preavisLoin, "avant sa limite de préavis");

  const proche = premier(
    e.plans.filter((p) => p.statut_echeance === "a_echeance" && p.prochaine_echeance),
    (p) => p.prochaine_echeance!,
  );
  if (proche) {
    const n = ecart(e.aujourdhui, proche.prochaine_echeance!);
    return {
      titre: proche.type_libelle,
      detail: perimetreDe(proche) || "Échéance proche",
      pourquoi: `Échéance la plus proche : ${n === 0 ? "aujourd'hui" : `dans ${jours(n)}`} (${fr(proche.prochaine_echeance!)}). Le temps de commander la visite.`,
      lien: `/controles/plans/${proche.plan_controle_id}`,
      action: "Voir le plan",
    };
  }
  return null;
}

export type Regroupement = {
  prestataire_id: string;
  prestataire_nom: string;
  du: string;
  au: string;
  plans: { plan_controle_id: string; type_libelle: string; perimetre: string; echeance: string }[];
};

/**
 * Contrôles d'un même prestataire à faire dans une même fenêtre (retards compris) : une seule visite
 * suffit peut-être. Fenêtre = seuil « à échéance » ; au moins deux contrôles.
 */
export function regroupements(plans: PlanJour[], aujourdhui: string, fenetreJours: number): Regroupement[] {
  const limite = format(addDays(parseISO(aujourdhui), fenetreJours), "yyyy-MM-dd");
  const parPrestataire = new Map<string, PlanJour[]>();
  for (const p of plans) {
    if (!p.prestataire_id || !p.prochaine_echeance || p.prochaine_echeance > limite) continue;
    if (p.statut_echeance !== "en_retard" && p.statut_echeance !== "a_echeance") continue;
    parPrestataire.set(p.prestataire_id, [...(parPrestataire.get(p.prestataire_id) ?? []), p]);
  }
  return [...parPrestataire.values()]
    .filter((liste) => liste.length >= 2)
    .map((liste) => {
      const tries = [...liste].sort((a, b) => a.prochaine_echeance!.localeCompare(b.prochaine_echeance!));
      return {
        prestataire_id: tries[0].prestataire_id!,
        prestataire_nom: tries[0].prestataire_nom ?? "",
        du: tries[0].prochaine_echeance!,
        au: tries[tries.length - 1].prochaine_echeance!,
        plans: tries.map((p) => ({
          plan_controle_id: p.plan_controle_id,
          type_libelle: p.type_libelle,
          perimetre: perimetreDe(p),
          echeance: p.prochaine_echeance!,
        })),
      };
    })
    .sort((a, b) => a.du.localeCompare(b.du));
}
