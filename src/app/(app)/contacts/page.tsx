import Link from "next/link";
import { Mail, Phone, Plus } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requete } from "@/lib/auth";
import { lienTelephone } from "@/lib/metier/contacts";
import { listerContacts } from "@/lib/requetes/contacts";

export const metadata = { title: "Contacts — Jalon" };

/** Annuaire central : un appel ou un mail en un geste. */
export default async function PageContacts({ searchParams }: PageProps<"/contacts">) {
  const { q: brut } = await searchParams;
  const q = typeof brut === "string" && brut.length <= 100 ? brut : undefined;
  const { contacts, peutEcrire } = await requete(async (tx, u) => ({
    contacts: await listerContacts(tx, q),
    peutEcrire: u.role !== "lecture",
  }));

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        {peutEcrire && (
          <LienBouton href="/contacts/nouveau">
            <Plus className="size-4" aria-hidden />
            Nouveau contact
          </LienBouton>
        )}
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto]" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Nom, organisation, fonction, téléphone…"
          className="h-11 text-base"
          aria-label="Filtrer"
        />
        <Button type="submit" variant="secondary" className="h-11">
          Filtrer
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {contacts.length} contact{contacts.length > 1 ? "s" : ""}
      </p>

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {q ? "Aucun contact ne correspond." : "Aucun contact."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Link href={`/contacts/${c.id}`} className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{c.nom}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {[c.organisation, c.fonction].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="truncate text-sm">{c.telephone ?? c.email ?? "Aucune coordonnée"}</span>
              </Link>
              {c.telephone && (
                <a
                  href={lienTelephone(c.telephone)}
                  aria-label={`Appeler ${c.nom}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-primary text-primary-foreground"
                >
                  <Phone className="size-5" aria-hidden />
                </a>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  aria-label={`Écrire à ${c.nom}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg border"
                >
                  <Mail className="size-5" aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
