// « Trous dans le suivi » : ce qui ne déclenche aucune alerte mais trahit un oubli possible.
// Aucun jugement réglementaire : on signale des incohérences de saisie, l'utilisateur décide.

import { addMonths, format, parseISO } from "date-fns";

export type ElementAVerifier = { libelle: string; detail: string; lien: string };
export type CategorieAVerifier = { cle: string; titre: string; explication: string; elements: ElementAVerifier[] };

export type EntreeVerifications = {
  aujourdhui: string;
  plans: {
    plan_controle_id: string;
    type_libelle: string;
    caractere: "reglementaire" | "obligatoire" | "interne";
    perimetre: string | null;
    equipement_code: string | null;
    prestataire_id: string | null;
    periodicite_mois: number;
    dernier_controle: string | null;
  }[];
  reservesADetailler: { id: string; type_libelle: string; plan_controle_id: string; date_constat: string }[];
  contratsSansFin: { id: string; objet: string; prestataire_nom: string }[];
  equipementsSansPlan: { id: string; code: string; libelle: string }[];
};

const fr = (iso: string) => iso.split("-").reverse().join("/");
const perimetre = (p: EntreeVerifications["plans"][number]) =>
  [p.equipement_code, p.perimetre].filter(Boolean).join(" — ") || "Périmètre non précisé";

/** Catégories non vides, de la plus révélatrice d'un oubli à la plus anodine. */
export function trousDuSuivi(e: EntreeVerifications): CategorieAVerifier[] {
  const categories: CategorieAVerifier[] = [
    {
      cle: "periodes",
      titre: "Plus d'une période sans contrôle",
      explication:
        "Le dernier contrôle enregistré date de plus de deux périodes : plan oublié, ou contrôle réalisé mais jamais saisi ?",
      elements: e.plans
        .filter(
          (p) =>
            p.dernier_controle !== null &&
            format(addMonths(parseISO(p.dernier_controle), 2 * p.periodicite_mois), "yyyy-MM-dd") < e.aujourdhui,
        )
        .map((p) => ({
          libelle: p.type_libelle,
          detail: `${perimetre(p)} · dernier contrôle le ${fr(p.dernier_controle!)}, tous les ${p.periodicite_mois} mois`,
          lien: `/controles/plans/${p.plan_controle_id}`,
        })),
    },
    {
      cle: "reserves",
      titre: "Réserves à détailler",
      explication:
        "Créées par la saisie rapide (nombre de réserves) ou par l'import : sans description ni gravité, elles ne disent pas quoi lever.",
      elements: e.reservesADetailler.map((r) => ({
        libelle: r.type_libelle,
        detail: `Constatée le ${fr(r.date_constat)}`,
        lien: `/controles/reserves/${r.id}`,
      })),
    },
    {
      cle: "prestataires",
      titre: "Contrôles réglementaires ou obligatoires sans prestataire",
      explication:
        "Qui réalise ces contrôles ? Sans prestataire, ils n'apparaissent dans aucun regroupement de visites. Ignorez si l'équipe les fait elle-même.",
      elements: e.plans
        .filter((p) => p.caractere !== "interne" && p.prestataire_id === null)
        .map((p) => ({
          libelle: p.type_libelle,
          detail: perimetre(p),
          lien: `/controles/plans/${p.plan_controle_id}`,
        })),
    },
    {
      cle: "contrats",
      titre: "Contrats sans date de fin",
      explication: "Aucune alerte de préavis n'est possible sans date de fin.",
      elements: e.contratsSansFin.map((c) => ({
        libelle: c.objet,
        detail: c.prestataire_nom,
        lien: `/contrats/${c.id}`,
      })),
    },
    {
      cle: "equipements",
      titre: "Équipements en service sans contrôle suivi",
      explication: "Normal pour beaucoup de matériels ; à vérifier pour ceux qui relèvent d'une obligation.",
      elements: e.equipementsSansPlan.map((x) => ({
        libelle: `${x.code} — ${x.libelle}`,
        detail: "Aucun plan de contrôle actif",
        lien: `/equipements/${x.id}`,
      })),
    },
  ];
  return categories.filter((c) => c.elements.length > 0);
}
