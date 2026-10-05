// Mail récapitulatif des rappels. Contenu minimal : libellé, échéance, lien. Jamais de texte libre saisi.

import type { ResultatRappels } from "@/lib/metier/rappels";

export type Mail = { sujet: string; html: string; texte: string };

const ENTITES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function echapper(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ENTITES[c]);
}

const TITRES = {
  plan_controle: "Contrôles à venir",
  contrat: "Contrats : préavis à venir",
  reserve: "Réserves à lever",
} as const;

type Ligne = { libelle: string; detail: string; lien: string; seuil?: string };

export function composerMail(r: ResultatRappels, appUrl: string): Mail {
  const base = appUrl.replace(/\/$/, "");
  const sections: { titre: string; lignes: Ligne[] }[] = [];

  for (const type of ["plan_controle", "contrat", "reserve"] as const) {
    const lignes = r.rappels.filter((x) => x.cible_type === type);
    if (lignes.length) sections.push({ titre: TITRES[type], lignes });
  }
  if (r.recap) {
    sections.push({
      titre: "Récapitulatif hebdomadaire des retards",
      lignes: r.recap.lignes.length
        ? r.recap.lignes
        : [{ libelle: "Rien en retard cette semaine.", detail: "", lien: "/" }],
    });
  }

  const nb = r.rappels.length;
  const nbRetards = r.recap?.lignes.length ?? 0;
  const sujet = [
    "Jalon",
    nb ? `${nb} rappel${nb > 1 ? "s" : ""}` : null,
    r.recap ? `récapitulatif : ${nbRetards ? `${nbRetards} en retard` : "rien en retard"}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  const seuil = (l: Ligne) => (l.seuil ? l.seuil.replace("J", "J-") : "");

  const texte = [
    ...sections.flatMap((s) => [
      `== ${s.titre} ==`,
      ...s.lignes.map(
        (l) => `- ${l.seuil ? `[${seuil(l)}] ` : ""}${l.libelle}${l.detail ? ` : ${l.detail}` : ""} — ${base}${l.lien}`,
      ),
      "",
    ]),
    "Jalon aide au suivi ; il ne certifie aucune conformité.",
  ].join("\n");

  const ligneHtml = (l: Ligne) =>
    `<li style="margin:6px 0"><a href="${echapper(base + l.lien)}" style="color:#1d4ed8;font-weight:600">${echapper(
      l.libelle,
    )}</a>${l.detail ? ` — ${echapper(l.detail)}` : ""}${
      l.seuil ? ` <span style="color:#666">(${echapper(seuil(l))})</span>` : ""
    }</li>`;

  const html = [
    `<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;color:#111;max-width:640px;margin:auto;padding:16px">`,
    ...sections.map(
      (s) =>
        `<h2 style="font-size:18px;border-bottom:1px solid #ddd;padding-bottom:4px">${echapper(s.titre)}</h2>` +
        `<ul style="padding-left:18px">${s.lignes.map(ligneHtml).join("")}</ul>`,
    ),
    `<p style="color:#666;font-size:12px;margin-top:24px">Jalon aide au suivi ; il ne certifie aucune conformité.</p>`,
    `</body></html>`,
  ].join("\n");

  return { sujet, html, texte };
}
