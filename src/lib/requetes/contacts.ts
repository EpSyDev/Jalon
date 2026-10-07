import "server-only";
import type { Tx } from "@/lib/db";

export type Contact = {
  id: string;
  nom: string;
  organisation: string | null;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  notes: string | null;
  prestataire_id: string | null;
  prestataire_nom: string | null;
};

const COLONNES = `c.id, c.nom, c.organisation, c.fonction, c.telephone, c.email, c.notes, c.prestataire_id,
  p.nom as prestataire_nom`;

export function listerContacts(tx: Tx, q?: string) {
  const motif = q?.trim() ? `%${q.trim()}%` : null;
  return tx<Contact[]>`
    select ${tx.unsafe(COLONNES)}
    from public.contacts c left join public.prestataires p on p.id = c.prestataire_id
    where c.archive_le is null
      and (${motif}::text is null or public.normaliser(concat_ws(' ', c.nom, c.organisation, c.fonction, c.telephone, c.email))
        like public.normaliser(${motif}))
    order by public.normaliser(coalesce(c.organisation, c.nom)), public.normaliser(c.nom)`;
}

export async function lireContact(tx: Tx, id: string): Promise<Contact | undefined> {
  const [c] = await tx<Contact[]>`
    select ${tx.unsafe(COLONNES)}
    from public.contacts c left join public.prestataires p on p.id = c.prestataire_id
    where c.id = ${id} and c.archive_le is null`;
  return c;
}

export function optionsPrestataires(tx: Tx) {
  return tx<{ id: string; libelle: string }[]>`
    select id, nom as libelle from public.prestataires where archive_le is null order by nom`;
}
