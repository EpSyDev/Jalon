// Cas partagés entre le test unitaire TS et le test de parité SQL.

export const CAS_PROCHAINE_ECHEANCE: Array<{
  nom: string;
  dernier: string | null;
  mois: number;
  attendu: string | null;
}> = [
  { nom: "jamais contrôlé", dernier: null, mois: 12, attendu: null },
  { nom: "cas simple", dernier: "2026-03-15", mois: 12, attendu: "2027-03-15" },
  { nom: "31 janvier + 1 mois, année non bissextile", dernier: "2027-01-31", mois: 1, attendu: "2027-02-28" },
  { nom: "31 janvier + 1 mois, année bissextile", dernier: "2028-01-31", mois: 1, attendu: "2028-02-29" },
  { nom: "29 février + 12 mois", dernier: "2028-02-29", mois: 12, attendu: "2029-02-28" },
  { nom: "31 août + 6 mois", dernier: "2026-08-31", mois: 6, attendu: "2027-02-28" },
  { nom: "31 mars + 1 mois", dernier: "2026-03-31", mois: 1, attendu: "2026-04-30" },
  { nom: "passage de l'heure d'hiver", dernier: "2026-09-25", mois: 1, attendu: "2026-10-25" },
  { nom: "périodicité maximale", dernier: "2026-01-01", mois: 120, attendu: "2036-01-01" },
];

export const CAS_STATUT: Array<{
  nom: string;
  echeance: string | null;
  aujourdhui: string;
  seuil: number;
  attendu: string;
}> = [
  { nom: "aucun contrôle", echeance: null, aujourdhui: "2026-10-06", seuil: 60, attendu: "jamais_controle" },
  { nom: "échéance hier", echeance: "2026-10-05", aujourdhui: "2026-10-06", seuil: 60, attendu: "en_retard" },
  { nom: "échéance aujourd'hui", echeance: "2026-10-06", aujourdhui: "2026-10-06", seuil: 60, attendu: "a_echeance" },
  { nom: "échéance à J+60 pile", echeance: "2026-12-05", aujourdhui: "2026-10-06", seuil: 60, attendu: "a_echeance" },
  { nom: "échéance à J+61", echeance: "2026-12-06", aujourdhui: "2026-10-06", seuil: 60, attendu: "a_jour" },
  { nom: "seuil paramétré à 30", echeance: "2026-11-06", aujourdhui: "2026-10-06", seuil: 30, attendu: "a_jour" },
  {
    nom: "seuil franchi au changement d'année",
    echeance: "2027-01-15",
    aujourdhui: "2026-12-20",
    seuil: 60,
    attendu: "a_echeance",
  },
];
