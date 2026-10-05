import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EnvRappels } from "@/lib/env";
import type { Mail } from "./composer";

export const DOSSIER_MAILS = join(process.cwd(), ".data", "mails");

export type MailEnvoye = Mail & { a: string[]; date: string };

/** Envoie un mail : fichier local en développement, Resend (région UE) en production. */
export async function envoyerMail(env: EnvRappels, a: string[], mail: Mail): Promise<void> {
  if (env.MAIL_MODE === "local") {
    await mkdir(DOSSIER_MAILS, { recursive: true });
    const date = new Date().toISOString();
    const contenu: MailEnvoye = { ...mail, a, date };
    await writeFile(join(DOSSIER_MAILS, `${date.replace(/[:.]/g, "-")}.json`), JSON.stringify(contenu, null, 2));
    return;
  }
  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_EXPEDITEUR, to: a, subject: mail.sujet, html: mail.html, text: mail.texte }),
  });
  // Ne jamais journaliser la clé ni le contenu : seulement le statut.
  if (!reponse.ok) throw new Error(`Envoi refusé par Resend (HTTP ${reponse.status}).`);
}

/** Mails écrits en mode local, du plus récent au plus ancien. */
export async function lireMailsLocaux(limite = 30): Promise<(MailEnvoye & { id: string })[]> {
  const fichiers = await readdir(DOSSIER_MAILS).catch(() => [] as string[]);
  const recents = fichiers
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limite);
  return Promise.all(
    recents.map(async (f) => ({
      id: f,
      ...(JSON.parse(await readFile(join(DOSSIER_MAILS, f), "utf8")) as MailEnvoye),
    })),
  );
}
