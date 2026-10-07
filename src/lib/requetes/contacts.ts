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

/**
 * Crée le contact d'un prestataire à partir de ses coordonnées, s'il en a et si aucun contact actif ne lui est
 * encore lié. Doublon voulu : l'annuaire vit ensuite séparément de la fiche prestataire.
 */
export async function contactDepuisPrestataire(
  tx: Tx,
  prestataireId: string,
  p: { nom: string; contact_nom: string | null; email: string | null; telephone: string | null },
): Promise<boolean> {
  if (!p.contact_nom && !p.email && !p.telephone) return false;
  const [existant] = await tx`
    select 1 from public.contacts where prestataire_id = ${prestataireId} and archive_le is null limit 1`;
  if (existant) return false;
  await tx`
    insert into public.contacts (nom, organisation, telephone, email, prestataire_id)
    values (${p.contact_nom ?? p.nom}, ${p.nom}, ${p.telephone}, ${p.email}, ${prestataireId})`;
  return true;
}
