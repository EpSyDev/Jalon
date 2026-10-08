// Lecture d'un rapport de vérification PDF (texte extrait page par page) : de quoi PRÉ-REMPLIR la saisie des
// contrôles, jamais enregistrer seul. Règles écrites sur les rapports Bureau Veritas (vérification générale
// périodique) : en-tête (date d'intervention, référence, nombre de fiches), puis le récapitulatif des équipements
// (« Fiche n° 1 : LOCALISATION / Marque: … Type: … n°série: … / Avis général : … »). Rien n'est deviné : ce qui
// n'est pas lu reste vide, et tout écart entre ce qui est annoncé et ce qui est lu est signalé.

import { masquerNoms } from "./noms";
import { normaliser } from "./import";

export type ResultatPropose = "conforme" | "non_conforme";

export type FicheRapport = {
  numero: number;
  localisation: string | null;
  marque: string | null;
  type: string | null;
  numero_serie: string | null;
  /** Avis tel qu'écrit (« Satisfaisant. »). */
  avis: string | null;
  /** Proposition seulement quand l'avis est sans ambiguïté ; sinon à choisir. */
  resultat_propose: ResultatPropose | null;
};

export type RapportLu = {
  organisme: string | null;
  objet: string | null;
  date_intervention: string | null;
  reference: string | null;
  nb_fiches_annonce: number | null;
  fiches: FicheRapport[];
  /** Écarts et manques à vérifier par l'utilisateur. */
  alertes: string[];
};

const ORGANISMES = ["Bureau Veritas", "APAVE", "SOCOTEC", "DEKRA", "Qualiconsult", "Bureau Alpes Contrôles"];

const propre = (t: string | undefined | null) => {
  const v = t?.replace(/\s+/g, " ").trim();
  return v ? masquerNoms(v) : null;
};

/** JJ/MM/AAAA → AAAA-MM-JJ (date réelle seulement). */
function dateIso(t: string | undefined): string | null {
  const m = t ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t) : null;
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) ? iso : null;
}

function resultatPropose(avis: string | null): ResultatPropose | null {
  const n = normaliser(avis ?? "");
  if (n === "satisfaisant") return "conforme";
  if (n === "non satisfaisant") return "non_conforme";
  return null;
}

export function lireRapport(pages: string[]): RapportLu {
  const texte = pages.join("\n").replace(/ /g, " ");
  const alertes: string[] = [];

  const organisme = ORGANISMES.find((o) => texte.toLowerCase().includes(o.toLowerCase())) ?? null;

  // Objet : « Rapport de vérification … de » se poursuit souvent sur la ligne suivante.
  const lignes = texte.split("\n").map((l) => l.trim());
  const iObjet = lignes.findIndex((l) => /^Rapport de /i.test(l));
  const objet =
    iObjet === -1
      ? null
      : propre(
          /\b(de|du|des|d')$/i.test(lignes[iObjet]) && lignes[iObjet + 1]
            ? `${lignes[iObjet]} ${lignes[iObjet + 1]}`
            : lignes[iObjet],
        );

  const date_intervention = dateIso(
    /Intervention du\s+(\d{2}\/\d{2}\/\d{4})/i.exec(texte)?.[1] ??
      /Date (?:d'intervention|de (?:la )?(?:visite|vérification))\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(texte)?.[1],
  );
  const reference = propre(
    /Référence du rapport\s*:\s*(\S+)/i.exec(texte)?.[1] ?? /rapport n°\s*:\s*(\S+)/i.exec(texte)?.[1],
  );
  const annonce = /Ce rapport contient\s+(\d+)\s+fiches?/i.exec(texte);
  const nb_fiches_annonce = annonce ? Number(annonce[1]) : null;

  // Récapitulatif : « Fiche n° 1 : LOCAL TRI SELECTIF », puis marque / type / n° de série et avis général.
  const fiches: FicheRapport[] = [];
  const motif = /Fiche n°\s*(\d+)\s*:\s*([^\n]*)\n([\s\S]*?)(?=Fiche n°\s*\d+\s*:|Rapport –|Rapport -|$)/gi;
  for (const m of texte.matchAll(motif)) {
    const numero = Number(m[1]);
    if (fiches.some((f) => f.numero === numero)) continue;
    const bloc = m[3];
    const avis = propre(/Avis général\s*:\s*([^\n]+)/i.exec(bloc)?.[1]);
    fiches.push({
      numero,
      localisation: propre(m[2]),
      marque: propre(/Marque\s*:\s*(.+?)(?=\s+Type\s*:|\n|$)/i.exec(bloc)?.[1]),
      type: propre(/Type\s*:\s*(.+?)(?=\s+n°\s*s[ée]rie|\n|$)/i.exec(bloc)?.[1]),
      numero_serie: propre(/n°\s*s[ée]rie\s*:\s*(\S+)/i.exec(bloc)?.[1]),
      avis,
      resultat_propose: resultatPropose(avis),
    });
  }

  if (!date_intervention) alertes.push("Date d'intervention introuvable : à saisir.");
  if (fiches.length === 0) alertes.push("Aucune fiche d'équipement repérée : choisissez le contrôle à la main.");
  if (nb_fiches_annonce !== null && nb_fiches_annonce !== fiches.length) {
    alertes.push(`Le rapport annonce ${nb_fiches_annonce} fiche(s), ${fiches.length} lue(s) : vérifiez le rapport.`);
  }
  for (const f of fiches) {
    if (!f.avis) alertes.push(`Fiche n° ${f.numero} : avis général introuvable.`);
    else if (!f.resultat_propose) {
      alertes.push(`Fiche n° ${f.numero} : avis « ${f.avis} » à traduire en résultat, et réserves à saisir.`);
    }
  }
  return { organisme, objet, date_intervention, reference, nb_fiches_annonce, fiches, alertes };
}
