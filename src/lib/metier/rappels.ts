// Calcul des rappels mail : fonction pure, testée. Le cron lit les données, appelle
// calculerRappels, envoie un seul mail, puis enregistre ce qui a été envoyé.

import { differenceInCalendarDays, getISODay, parseISO } from "date-fns";
import { alerteContrat, limitePreavis } from "./contrats";
import { depuisJours, interventionEnRetard, messageRetardChantier, retardChantier } from "./retards";

export type CibleRappel = "plan_controle" | "contrat" | "reserve" | "recap_hebdo";

export type Rappel = {
  cible_type: CibleRappel;
  cible_id: string | null;
  seuil: string;
  echeance: string;
  libelle: string;
  detail: string;
  lien: string;
};

export type EntreeRappels = {
  aujourdhui: string;
  /** Jours avant échéance, ex. [60, 30, 7]. */
  seuils: number[];
  /** Jour ISO du récapitulatif (1 = lundi). */
  jourRecap: number;
  plans: {
    id: string;
    libelle: string;
    perimetre: string | null;
    echeance: string | null;
    statut: "jamais_controle" | "en_retard" | "a_echeance" | "a_jour";
  }[];
  contrats: { id: string; objet: string; prestataire: string; date_fin: string | null; preavis_jours: number | null }[];
  /** Pas de description : texte libre, jamais repris dans un mail. */
  reserves: {
    id: string;
    gravite: "mineure" | "majeure" | "critique" | null;
    plan_id: string;
    plan_libelle: string;
    echeance_levee: string | null;
  }[];
  /** Interventions non terminées (seules celles en retard figurent au récapitulatif). */
  interventions?: { id: string; titre: string; statut: string; date_prevue: string | null }[];
  /** Chantiers actifs (seuls ceux en retard figurent au récapitulatif). */
  chantiers?: {
    id: string;
    titre: string;
    statut: string;
    date_debut: string | null;
    date_fin_prevue: string | null;
  }[];
  /** Message d'alerte sur la sauvegarde (null = récente). Une panne de sauvegarde se lit au récapitulatif. */
  alerteSauvegarde?: string | null;
  /** Clés « cible_type|cible_id|seuil|echeance » déjà enregistrées. */
  dejaEnvoyes: Set<string>;
};

export type ResultatRappels = {
  rappels: Rappel[];
  recap: { du: string; lignes: Omit<Rappel, "seuil" | "echeance" | "cible_type" | "cible_id">[] } | null;
};

export const cleRappel = (r: Pick<Rappel, "cible_type" | "cible_id" | "seuil" | "echeance">) =>
  `${r.cible_type}|${r.cible_id ?? ""}|${r.seuil}|${r.echeance}`;

const fr = (iso: string) => iso.split("-").reverse().join("/");

/** Libellé de réserve pour les mails : jamais la description saisie (texte libre). */
export function libelleReserve(r: Pick<EntreeRappels["reserves"][number], "gravite" | "plan_libelle">): string {
  return `Réserve${r.gravite ? ` ${r.gravite}` : ""} — ${r.plan_libelle}`;
}

/**
 * Seuil le plus urgent atteint pour une échéance à venir (ou du jour).
 * Un passage manqué du cron est rattrapé : on teste « ≤ », jamais « = ».
 */
export function seuilAtteint(echeance: string, aujourdhui: string, seuils: number[]): string | null {
  const jours = differenceInCalendarDays(parseISO(echeance), parseISO(aujourdhui));
  if (jours < 0) return null;
  const atteints = seuils.filter((s) => jours <= s);
  return atteints.length ? `J${Math.min(...atteints)}` : null;
}

export function calculerRappels(e: EntreeRappels): ResultatRappels {
  const rappels: Rappel[] = [];
  const ajouter = (r: Rappel) => {
    if (!e.dejaEnvoyes.has(cleRappel(r))) rappels.push(r);
  };

  for (const p of e.plans) {
    if (!p.echeance) continue;
    const seuil = seuilAtteint(p.echeance, e.aujourdhui, e.seuils);
    if (seuil) {
      ajouter({
        cible_type: "plan_controle",
        cible_id: p.id,
        seuil,
        echeance: p.echeance,
        libelle: p.libelle,
        detail: `${p.perimetre ? `${p.perimetre} · ` : ""}échéance le ${fr(p.echeance)}`,
        lien: `/controles/plans/${p.id}`,
      });
    }
  }

  for (const c of e.contrats) {
    if (!c.date_fin) continue;
    const limite = limitePreavis(c.date_fin, c.preavis_jours);
    const seuil = seuilAtteint(limite, e.aujourdhui, e.seuils);
    if (seuil) {
      ajouter({
        cible_type: "contrat",
        cible_id: c.id,
        seuil,
        echeance: limite,
        libelle: c.objet,
        detail: `${c.prestataire} · ${c.preavis_jours ? `préavis à donner avant le ${fr(limite)}` : `fin le ${fr(c.date_fin)}`}`,
        lien: `/contrats/${c.id}`,
      });
    }
  }

  for (const r of e.reserves) {
    if (!r.echeance_levee) continue;
    const seuil = seuilAtteint(r.echeance_levee, e.aujourdhui, e.seuils);
    if (seuil) {
      ajouter({
        cible_type: "reserve",
        cible_id: r.id,
        seuil,
        echeance: r.echeance_levee,
        libelle: libelleReserve(r),
        detail: `${r.plan_libelle} · à lever avant le ${fr(r.echeance_levee)}`,
        lien: `/controles/plans/${r.plan_id}`,
      });
    }
  }

  // Récapitulatif hebdomadaire des retards : envoyé même vide (son absence signale une panne).
  let recap: ResultatRappels["recap"] = null;
  const recapDu = { cible_type: "recap_hebdo", cible_id: null, seuil: "retard", echeance: e.aujourdhui } as const;
  if (getISODay(parseISO(e.aujourdhui)) === e.jourRecap && !e.dejaEnvoyes.has(cleRappel(recapDu))) {
    const lignes: NonNullable<ResultatRappels["recap"]>["lignes"] = [];
    for (const p of e.plans) {
      if (p.statut === "en_retard" && p.echeance) {
        lignes.push({
          libelle: p.libelle,
          detail: `en retard depuis le ${fr(p.echeance)}`,
          lien: `/controles/plans/${p.id}`,
        });
      } else if (p.statut === "jamais_controle") {
        lignes.push({ libelle: p.libelle, detail: "jamais contrôlé", lien: `/controles/plans/${p.id}` });
      }
    }
    for (const r of e.reserves) {
      if (r.echeance_levee && r.echeance_levee < e.aujourdhui) {
        lignes.push({
          libelle: libelleReserve(r),
          detail: `réserve à lever depuis le ${fr(r.echeance_levee)}`,
          lien: `/controles/plans/${r.plan_id}`,
        });
      }
    }
    for (const c of e.contrats) {
      const alerte = alerteContrat(c, e.aujourdhui, 0);
      if (alerte === "echu" || alerte === "preavis_depasse") {
        lignes.push({
          libelle: c.objet,
          detail: alerte === "echu" ? `contrat échu le ${fr(c.date_fin!)}` : `préavis dépassé (${c.prestataire})`,
          lien: `/contrats/${c.id}`,
        });
      }
    }
    for (const i of e.interventions ?? []) {
      if (interventionEnRetard(i, e.aujourdhui)) {
        lignes.push({
          libelle: i.titre,
          detail: `intervention prévue le ${fr(i.date_prevue!)} (${depuisJours(i.date_prevue!, e.aujourdhui)})`,
          lien: `/interventions/${i.id}`,
        });
      }
    }
    for (const c of e.chantiers ?? []) {
      const retard = retardChantier(c, e.aujourdhui);
      if (retard) {
        lignes.push({
          libelle: c.titre,
          detail: `chantier : ${messageRetardChantier(c, retard, e.aujourdhui).toLowerCase()}`,
          lien: `/chantiers/${c.id}`,
        });
      }
    }
    if (e.alerteSauvegarde) lignes.push({ libelle: "Sauvegarde", detail: e.alerteSauvegarde, lien: "/parametres" });
    recap = { du: e.aujourdhui, lignes };
  }

  return { rappels, recap };
}

/** Lignes à enregistrer dans rappels_envoyes après un envoi réussi. */
export function aEnregistrer(r: ResultatRappels): Pick<Rappel, "cible_type" | "cible_id" | "seuil" | "echeance">[] {
  const lignes = r.rappels.map(({ cible_type, cible_id, seuil, echeance }) => ({
    cible_type,
    cible_id,
    seuil,
    echeance,
  }));
  if (r.recap) lignes.push({ cible_type: "recap_hebdo", cible_id: null, seuil: "retard", echeance: r.recap.du });
  return lignes;
}

/** Seuils valides : entiers distincts de 1 à 365, triés du plus lointain au plus proche. */
export function normaliserSeuils(valeurs: number[]): number[] {
  return [...new Set(valeurs.filter((v) => Number.isInteger(v) && v >= 1 && v <= 365))].sort((a, b) => b - a);
}
