import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { z } from "zod";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { lienTelephone } from "@/lib/metier/contacts";
import { lireContact } from "@/lib/requetes/contacts";

export const metadata = { title: "Contact — Jalon" };

export default async function PageContact({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const contact = await lireContact(tx, id);
    return contact ? { contact, peutEcrire: u.role !== "lecture" } : null;
  });
  if (!donnees) notFound();
  const { contact: c, peutEcrire } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/contacts" className="text-sm text-muted-foreground underline">
        ← Contacts
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{c.nom}</h1>
        <p className="text-muted-foreground">{[c.organisation, c.fonction].filter(Boolean).join(" · ")}</p>
      </div>

      {(c.telephone || c.email) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {c.telephone && (
            <LienBouton href={lienTelephone(c.telephone)} className="h-14 text-base">
              <Phone className="size-5" aria-hidden />
              {c.telephone}
            </LienBouton>
          )}
          {c.email && (
            <LienBouton href={`mailto:${c.email}`} variante="outline" className="h-14 text-base">
              <Mail className="size-5" aria-hidden />
              <span className="truncate">{c.email}</span>
            </LienBouton>
          )}
        </div>
      )}

      <dl className="grid gap-3 rounded-lg border bg-card p-4 text-sm">
        {c.prestataire_id && (
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Prestataire lié</dt>
            <dd>
              <Link href={`/prestataires/${c.prestataire_id}`} className="underline">
                {c.prestataire_nom}
              </Link>
            </dd>
          </div>
        )}
        {c.notes && (
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{c.notes}</dd>
          </div>
        )}
        {!c.prestataire_id && !c.notes && <p className="text-muted-foreground">Aucune autre information.</p>}
      </dl>

      {peutEcrire && (
        <LienBouton href={`/contacts/${c.id}/modifier`} variante="outline" className="h-12 text-base">
          Modifier
        </LienBouton>
      )}
    </div>
  );
}
