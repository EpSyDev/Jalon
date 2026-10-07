import "server-only";
import type { z } from "zod";
import type { Tx } from "@/lib/db";
import type { schemaNouveauControle } from "@/lib/metier/controles";

type Saisie = z.output<typeof schemaNouveauControle>;

export type ResultatCreation = { id: string; erreur?: never } | { erreur: string; id?: never };

/**
 * Crée un contrôle de bout en bout, dans la transaction de l'appelant :
 * famille (retrouvée ou créée) → type (retrouvé ou créé) → plan → dernier contrôle connu et ses réserves à détailler.
 * Un type existant n'est jamais modifié en silence : périodicité ou caractère différents → refus expliqué.
 */
export async function creerControleComplet(tx: Tx, c: Saisie): Promise<ResultatCreation> {
  // Famille
  let familleId = c.famille_id;
  if (familleId === null) {
    const [existante] = await tx<{ id: string }[]>`
      select id from public.familles_controle
      where archive_le is null and public.normaliser(libelle) = public.normaliser(${c.famille_nouvelle})`;
    familleId =
      existante?.id ??
      (
        await tx<{ id: string }[]>`
          insert into public.familles_controle (libelle) values (${c.famille_nouvelle}) returning id`
      )[0].id;
  }

  // Type : même famille, même intitulé (accents et casse ignorés)
  const [type] = await tx<{ id: string; periodicite_mois: number; caractere: string }[]>`
    select id, periodicite_mois, caractere from public.types_controle
    where archive_le is null and famille_id = ${familleId}
      and public.normaliser(libelle) = public.normaliser(${c.libelle})`;
  let typeId: string;
  if (type) {
    if (type.periodicite_mois !== c.periodicite_mois || type.caractere !== c.caractere) {
      return {
        erreur: `Ce contrôle existe déjà dans cette famille (${type.periodicite_mois} mois, ${type.caractere}) : modifiez-le dans « Types de contrôle » ou alignez la saisie.`,
      };
    }
    typeId = type.id;
  } else {
    [{ id: typeId }] = await tx<{ id: string }[]>`
      insert into public.types_controle (libelle, famille_id, caractere, periodicite_mois, reference_texte)
      values (${c.libelle}, ${familleId}, ${c.caractere}, ${c.periodicite_mois}, ${c.reference_texte}) returning id`;
  }

  // Plan : pas deux fois le même contrôle sur le même périmètre
  const [doublon] = await tx`
    select 1 from public.plans_controle
    where archive_le is null and type_controle_id = ${typeId}
      and equipement_id is not distinct from ${c.equipement_id}
      and public.normaliser(coalesce(perimetre_libelle, '')) = public.normaliser(${c.equipement_id ? "" : (c.perimetre_libelle ?? "")})`;
  if (doublon) return { erreur: "Ce contrôle existe déjà sur cet équipement ou ce périmètre." };

  const [{ id }] = await tx<{ id: string }[]>`
    insert into public.plans_controle (type_controle_id, equipement_id, perimetre_libelle, prestataire_id, actif)
    values (${typeId}, ${c.equipement_id}, ${c.equipement_id ? null : c.perimetre_libelle}, ${c.prestataire_id}, true)
    returning id`;

  // Dernier contrôle connu : évite le statut « jamais contrôlé »
  if (c.date_dernier && c.resultat) {
    const [controle] = await tx<{ id: string }[]>`
      insert into public.controles (plan_controle_id, date_realisation, resultat, nb_reserves_declare)
      values (${id}, ${c.date_dernier}, ${c.resultat}, ${c.nb_reserves_declare}) returning id`;
    if (c.nb_reserves_declare > 0) {
      await tx`
        insert into public.reserves (controle_id, date_constat)
        select ${controle.id}, ${c.date_dernier}::date from generate_series(1, ${c.nb_reserves_declare})`;
    }
  }
  return { id };
}

/** Listes de choix du formulaire « Nouveau contrôle ». */
export async function optionsNouveauControle(tx: Tx) {
  const [familles, equipements, prestataires] = await Promise.all([
    tx<{ id: string; libelle: string }[]>`
      select id, libelle from public.familles_controle where archive_le is null order by libelle`,
    tx<{ id: string; libelle: string }[]>`
      select id, code || ' — ' || libelle as libelle from public.equipements
      where archive_le is null and statut <> 'reforme' order by code`,
    tx<{ id: string; libelle: string }[]>`
      select id, nom as libelle from public.prestataires where archive_le is null order by nom`,
  ]);
  return { familles, equipements, prestataires };
}
