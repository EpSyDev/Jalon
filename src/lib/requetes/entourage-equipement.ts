import "server-only";
import type { Tx } from "@/lib/db";

export type PartenaireEquipement = {
  id: string;
  nom: string;
  contacts: { id: string; nom: string; fonction: string | null; telephone: string | null; email: string | null }[];
};

export type ContratEquipement = {
  id: string;
  objet: string;
  prestataire_nom: string;
  date_fin: string | null;
  preavis_jours: number | null;
};

export type ChantierEquipement = { id: string; titre: string; statut: string };

/**
 * Tout ce qui entoure un équipement : prestataires (de ses contrôles et de ses interventions) avec leurs contacts,
 * contrats rattachés à ses contrôles, chantiers de ses interventions.
 */
export async function entourageEquipement(tx: Tx, id: string) {
  const [partenaires, contacts, contrats, chantiers] = await Promise.all([
    tx<{ id: string; nom: string }[]>`
      select distinct pr.id, pr.nom from public.prestataires pr
      where pr.archive_le is null and (
        exists (select 1 from public.plans_controle p
                where p.equipement_id = ${id} and p.prestataire_id = pr.id and p.archive_le is null and p.actif)
        or exists (select 1 from public.interventions i
                   where i.equipement_id = ${id} and i.prestataire_id = pr.id and i.archive_le is null))
      order by pr.nom`,
    tx<(PartenaireEquipement["contacts"][number] & { prestataire_id: string })[]>`
      select c.id, c.nom, c.fonction, c.telephone, c.email, c.prestataire_id from public.contacts c
      where c.archive_le is null and c.prestataire_id in (
        select p.prestataire_id from public.plans_controle p
          where p.equipement_id = ${id} and p.archive_le is null and p.actif and p.prestataire_id is not null
        union
        select i.prestataire_id from public.interventions i
          where i.equipement_id = ${id} and i.archive_le is null and i.prestataire_id is not null)
      order by c.nom`,
    tx<ContratEquipement[]>`
      select distinct c.id, c.objet, pr.nom as prestataire_nom, c.date_fin, c.preavis_jours
      from public.contrats c
      join public.prestataires pr on pr.id = c.prestataire_id
      join public.plans_controle p on p.contrat_id = c.id
      where p.equipement_id = ${id} and p.archive_le is null and c.archive_le is null
      order by c.objet`,
    tx<ChantierEquipement[]>`
      select distinct ch.id, ch.titre, ch.statut from public.chantiers ch
      join public.interventions i on i.chantier_id = ch.id
      where i.equipement_id = ${id} and i.archive_le is null and ch.archive_le is null
      order by ch.titre`,
  ]);
  return {
    partenaires: partenaires.map<PartenaireEquipement>((p) => ({
      ...p,
      contacts: contacts.filter((c) => c.prestataire_id === p.id),
    })),
    contrats,
    chantiers,
  };
}
