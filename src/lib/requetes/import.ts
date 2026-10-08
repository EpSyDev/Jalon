import "server-only";
import { randomUUID } from "node:crypto";
import type { Tx } from "@/lib/db";
import type { Existant, OperationsControles, OperationsEquipements, Ref } from "@/lib/metier/import";

export async function lireExistant(tx: Tx): Promise<Existant> {
  const [familles, prestataires, types, equipements, plans, localisations, univers] = await Promise.all([
    tx<Existant["familles"]>`select id, libelle from public.familles_controle where archive_le is null`,
    tx<Existant["prestataires"]>`select id, nom from public.prestataires where archive_le is null`,
    tx<Existant["types"]>`
      select id, famille_id, libelle, caractere, periodicite_mois from public.types_controle where archive_le is null`,
    // Les codes archivés restent réservés (contrainte d'unicité) : on les inclut.
    tx<Existant["equipements"]>`select id, code, numero_serie from public.equipements`,
    tx<Existant["plans"]>`
      select type_controle_id, equipement_id, perimetre_libelle from public.plans_controle where archive_le is null`,
    tx<Existant["localisations"]>`
      select id, batiment, niveau, local from public.localisations where archive_le is null`,
    tx<Existant["univers"]>`select id, libelle from public.univers where archive_le is null`,
  ]);
  return { familles, prestataires, types, equipements, plans, localisations, univers };
}

function resoudre(ref: Ref, crees: Map<string, string>): string {
  if ("id" in ref) return ref.id;
  const id = crees.get(ref.nouveau);
  if (!id) throw new Error(`Référence d'import non résolue : ${ref.nouveau}`);
  return id;
}

const resoudreOuNull = (ref: Ref | null, crees: Map<string, string>) => (ref ? resoudre(ref, crees) : null);

// Insertions par lots : un fichier de quelques milliers de lignes ne fait plus un aller-retour par ligne
// (la base est à Dublin, les fonctions à Paris). Les identifiants sont générés ici pour relier les lots.
const LOT = 500;

async function parLots<T>(lignes: T[], inserer: (lot: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < lignes.length; i += LOT) await inserer(lignes.slice(i, i + LOT));
}

/** Associe à chaque clé un nouvel identifiant. */
function nouveauxIds(cles: string[]): Map<string, string> {
  return new Map(cles.map((c) => [c, randomUUID()]));
}

async function creerFamilles(tx: Tx, libelles: string[]): Promise<Map<string, string>> {
  const ids = nouveauxIds(libelles);
  await parLots(
    libelles,
    (lot) => tx`insert into public.familles_controle ${tx(lot.map((libelle) => ({ id: ids.get(libelle)!, libelle })))}`,
  );
  return ids;
}

export async function executerControles(tx: Tx, ops: OperationsControles) {
  const familles = await creerFamilles(tx, ops.familles);

  const prestataires = nouveauxIds(ops.prestataires);
  await parLots(
    ops.prestataires,
    (lot) => tx`insert into public.prestataires ${tx(lot.map((nom) => ({ id: prestataires.get(nom)!, nom })))}`,
  );

  const types = nouveauxIds(ops.types.map((t) => t.cle));
  await parLots(
    ops.types,
    (lot) =>
      tx`insert into public.types_controle ${tx(
        lot.map((t) => ({
          id: types.get(t.cle)!,
          libelle: t.libelle,
          famille_id: resoudre(t.famille, familles),
          caractere: t.caractere,
          periodicite_mois: t.periodicite_mois,
          reference_texte: t.reference_texte,
        })),
      )}`,
  );

  const plans = ops.plans.map((p) => ({ ...p, id: randomUUID() }));
  await parLots(
    plans,
    (lot) =>
      tx`insert into public.plans_controle ${tx(
        lot.map((p) => ({
          id: p.id,
          type_controle_id: resoudre(p.type, types),
          equipement_id: p.equipement_id,
          perimetre_libelle: p.perimetre_libelle,
          prestataire_id: resoudreOuNull(p.prestataire, prestataires),
        })),
      )}`,
  );

  const controles = plans.flatMap((p) => (p.dernier ? [{ plan: p.id, ...p.dernier, id: randomUUID() }] : []));
  await parLots(
    controles,
    (lot) =>
      tx`insert into public.controles ${tx(
        lot.map((c) => ({
          id: c.id,
          plan_controle_id: c.plan,
          date_realisation: c.date,
          resultat: c.resultat,
          commentaire: "Repris à l'import",
        })),
      )}`,
  );

  // Réserves inconnues à l'import : une réserve « à détailler » pour ne pas les oublier.
  const reserves = controles.filter((c) => c.resultat === "avec_reserves");
  await parLots(
    reserves,
    (lot) =>
      tx`insert into public.reserves ${tx(
        lot.map((c) => ({ controle_id: c.id, date_constat: c.date, description: "À détailler (reprise de l'import)" })),
      )}`,
  );

  return {
    familles: ops.familles.length,
    prestataires: ops.prestataires.length,
    types: ops.types.length,
    plans: ops.plans.length,
    controles: controles.length,
  };
}

export async function executerEquipements(tx: Tx, ops: OperationsEquipements) {
  const familles = await creerFamilles(tx, ops.familles);

  const univers = nouveauxIds(ops.univers);
  await parLots(
    ops.univers,
    (lot) => tx`insert into public.univers ${tx(lot.map((libelle) => ({ id: univers.get(libelle)!, libelle })))}`,
  );

  const localisations = nouveauxIds(ops.localisations.map((l) => l.cle));
  await parLots(
    ops.localisations,
    (lot) =>
      tx`insert into public.localisations ${tx(
        lot.map((l) => ({ id: localisations.get(l.cle)!, batiment: l.batiment, niveau: l.niveau, local: l.local })),
      )}`,
  );

  const equipements = nouveauxIds(ops.equipements.map((e) => e.code));
  await parLots(
    ops.equipements,
    (lot) =>
      tx`insert into public.equipements ${tx(
        lot.map((e) => ({
          id: equipements.get(e.code)!,
          code: e.code,
          libelle: e.libelle,
          univers_id: resoudreOuNull(e.univers, univers),
          famille_id: resoudreOuNull(e.famille, familles),
          localisation_id: resoudreOuNull(e.localisation, localisations),
          marque: e.marque,
          modele: e.modele,
          numero_serie: e.numero_serie,
          date_mise_en_service: e.date_mise_en_service,
          statut: e.statut,
          notes: e.notes,
        })),
      )}`,
  );

  // Maintenances reprises : type (au plus un), un plan par équipement, ses contrôles et les réserves ouvertes.
  const types = nouveauxIds(ops.types.map((t) => t.cle));
  await parLots(
    ops.types,
    (lot) =>
      tx`insert into public.types_controle ${tx(
        lot.map((t) => ({
          id: types.get(t.cle)!,
          libelle: t.libelle,
          famille_id: resoudre(t.famille, familles),
          caractere: t.caractere,
          periodicite_mois: t.periodicite_mois,
        })),
      )}`,
  );
  const plans = ops.maintenances.map((m) => ({ ...m, id: randomUUID() }));
  await parLots(
    plans,
    (lot) =>
      tx`insert into public.plans_controle ${tx(
        lot.map((p) => ({
          id: p.id,
          type_controle_id: resoudre(p.type, types),
          equipement_id: equipements.get(p.code)!,
          periodicite_mois_surcharge: p.periodicite_surcharge,
        })),
      )}`,
  );
  const controles = plans.flatMap((p) => p.controles.map((c) => ({ ...c, plan: p.id, id: randomUUID() })));
  await parLots(
    controles,
    (lot) =>
      tx`insert into public.controles ${tx(
        lot.map((c) => ({
          id: c.id,
          plan_controle_id: c.plan,
          date_realisation: c.date,
          resultat: c.resultat,
          nb_reserves_declare: c.nb_reserves,
          commentaire: c.commentaire,
        })),
      )}`,
  );
  const reserves = controles.flatMap((c) =>
    c.reserves.map((description) => ({ controle_id: c.id, date_constat: c.date, description })),
  );
  await parLots(reserves, (lot) => tx`insert into public.reserves ${tx(lot)}`);

  return {
    familles: ops.familles.length,
    univers: ops.univers.length,
    localisations: ops.localisations.length,
    equipements: ops.equipements.length,
    plans: plans.length,
    controles: controles.length,
    reserves: reserves.length,
  };
}
