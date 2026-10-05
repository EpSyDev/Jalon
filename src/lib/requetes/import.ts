import "server-only";
import type { Tx } from "@/lib/db";
import type { Existant, OperationsControles, OperationsEquipements, Ref } from "@/lib/metier/import";

export async function lireExistant(tx: Tx): Promise<Existant> {
  const [familles, prestataires, types, equipements, plans, localisations] = await Promise.all([
    tx<Existant["familles"]>`select id, libelle from public.familles_controle where archive_le is null`,
    tx<Existant["prestataires"]>`select id, nom from public.prestataires where archive_le is null`,
    tx<Existant["types"]>`
      select id, famille_id, libelle, caractere, periodicite_mois from public.types_controle where archive_le is null`,
    // Les codes archivés restent réservés (contrainte d'unicité) : on les inclut.
    tx<Existant["equipements"]>`select id, code from public.equipements`,
    tx<Existant["plans"]>`
      select type_controle_id, equipement_id, perimetre_libelle from public.plans_controle where archive_le is null`,
    tx<Existant["localisations"]>`
      select id, batiment, niveau, local from public.localisations where archive_le is null`,
  ]);
  return { familles, prestataires, types, equipements, plans, localisations };
}

function resoudre(ref: Ref, crees: Map<string, string>): string {
  if ("id" in ref) return ref.id;
  const id = crees.get(ref.nouveau);
  if (!id) throw new Error(`Référence d'import non résolue : ${ref.nouveau}`);
  return id;
}

async function creerFamilles(tx: Tx, libelles: string[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const libelle of libelles) {
    const [{ id }] = await tx<
      { id: string }[]
    >`insert into public.familles_controle (libelle) values (${libelle}) returning id`;
    ids.set(libelle, id);
  }
  return ids;
}

export async function executerControles(tx: Tx, ops: OperationsControles) {
  const familles = await creerFamilles(tx, ops.familles);
  const prestataires = new Map<string, string>();
  for (const nom of ops.prestataires) {
    const [{ id }] = await tx<{ id: string }[]>`insert into public.prestataires (nom) values (${nom}) returning id`;
    prestataires.set(nom, id);
  }
  const types = new Map<string, string>();
  for (const t of ops.types) {
    const [{ id }] = await tx<{ id: string }[]>`
      insert into public.types_controle (libelle, famille_id, caractere, periodicite_mois, reference_texte)
      values (${t.libelle}, ${resoudre(t.famille, familles)}, ${t.caractere}, ${t.periodicite_mois}, ${t.reference_texte})
      returning id`;
    types.set(t.cle, id);
  }
  let controles = 0;
  for (const p of ops.plans) {
    const [{ id }] = await tx<{ id: string }[]>`
      insert into public.plans_controle (type_controle_id, equipement_id, perimetre_libelle, prestataire_id)
      values (${resoudre(p.type, types)}, ${p.equipement_id}, ${p.perimetre_libelle},
        ${p.prestataire ? resoudre(p.prestataire, prestataires) : null})
      returning id`;
    if (p.dernier) {
      const [controle] = await tx<{ id: string }[]>`
        insert into public.controles (plan_controle_id, date_realisation, resultat, commentaire)
        values (${id}, ${p.dernier.date}, ${p.dernier.resultat}, 'Repris à l''import')
        returning id`;
      // Réserves inconnues à l'import : une réserve « à détailler » pour ne pas les oublier.
      if (p.dernier.resultat === "avec_reserves") {
        await tx`insert into public.reserves (controle_id, date_constat, description)
          values (${controle.id}, ${p.dernier.date}, 'À détailler (reprise de l''import)')`;
      }
      controles++;
    }
  }
  return {
    familles: ops.familles.length,
    prestataires: ops.prestataires.length,
    types: ops.types.length,
    plans: ops.plans.length,
    controles,
  };
}

export async function executerEquipements(tx: Tx, ops: OperationsEquipements) {
  const familles = await creerFamilles(tx, ops.familles);
  const localisations = new Map<string, string>();
  for (const l of ops.localisations) {
    const [{ id }] = await tx<{ id: string }[]>`
      insert into public.localisations (batiment, niveau, local) values (${l.batiment}, ${l.niveau}, ${l.local})
      returning id`;
    localisations.set(l.cle, id);
  }
  for (const e of ops.equipements) {
    await tx`
      insert into public.equipements
        (code, libelle, famille_id, localisation_id, marque, modele, numero_serie, date_mise_en_service, statut)
      values (${e.code}, ${e.libelle}, ${e.famille ? resoudre(e.famille, familles) : null},
        ${e.localisation ? resoudre(e.localisation, localisations) : null}, ${e.marque}, ${e.modele},
        ${e.numero_serie}, ${e.date_mise_en_service}, ${e.statut})`;
  }
  return {
    familles: ops.familles.length,
    localisations: ops.localisations.length,
    equipements: ops.equipements.length,
  };
}
