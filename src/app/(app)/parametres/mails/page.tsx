import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth";
import { lireEnvRappels } from "@/lib/env";
import { lireMailsLocaux } from "@/lib/mail/envoi";

export const metadata = { title: "Mails envoyés — Jalon" };

/** Boîte d'envoi du mode local : les mails sont des fichiers dans .data/mails. */
export default async function PageMailsLocaux() {
  await exigerUtilisateur(["admin"]);
  let local = false;
  try {
    local = lireEnvRappels().MAIL_MODE === "local";
  } catch {
    // configuration absente : page indisponible
  }
  if (!local) notFound();
  const mails = await lireMailsLocaux();

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4 md:p-8">
      <Link href="/parametres" className="text-sm text-muted-foreground underline">
        ← Paramètres
      </Link>
      <h1 className="text-2xl font-semibold">Mails envoyés (mode local)</h1>
      {mails.length === 0 && <p className="text-muted-foreground">Aucun mail pour l&apos;instant.</p>}
      {mails.map((m) => (
        <details key={m.id} className="rounded-lg border p-4">
          <summary className="cursor-pointer">
            <span className="font-medium">{m.sujet}</span>
            <span className="block text-sm text-muted-foreground">
              {new Date(m.date).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · à {m.a.join(", ")}
            </span>
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">{m.texte}</pre>
        </details>
      ))}
    </div>
  );
}
