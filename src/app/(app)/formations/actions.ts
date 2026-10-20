"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, RefusMetier, valider, type Resultat } from "@/lib/actions";
import type { Tx } from "@/lib/db";
import {
  calculerEcheance,
  schemaAgent,
  schemaFormation,
  schemaModifFormation,
  schemaTypeFormation,
} from "@/lib/metier/formations";

const LIBELLES: Record<string, string> = {
  agent_id: "Agent",
  agent_nouveau: "Nouvel agent",
  type_formation_id: "Formation",
  type_nouveau: "Nouvelle formation",
  validite_mois_nouveau: "Validité (mois)",
  validite_mois: "Validité (mois)",
  date_formation: "Date de la formation",
  duree_heures: "Durée (heures)",
  organisme: "Organisme",
  echeance: "Échéance",
  nom: "Nom",
  fonction: "Fonction",
  libelle: "Formation",
  notes: "Notes",
};

const rafraichir = () => revalidatePath("/formations", "layout");
const doublon = (m: string) => m.replace("Cet élément existe déjà.", "Ce nom existe déjà.");

/** Agent existant (même nom, casse ignorée) ou créé à la volée. */
async function agentPour(tx: Tx, nom: string): Promise<string> {
  const [existant] = await tx<{ id: string }[]>`
    select id from public.agents where lower(nom) = lower(${nom}) and archive_le is null`;
  if (existant) return existant.id;
  const [cree] = await tx<{ id: string }[]>`insert into public.agents (nom) values (${nom}) returning id`;
  return cree.id;
}

/** Type existant (et sa validité) ou créé à la volée avec la validité saisie. */
async function typePour(tx: Tx, libelle: string, validite: number | null) {
  const [existant] = await tx<{ id: string; validite_mois: number | null }[]>`
    select id, validite_mois from public.types_formation where lower(libelle) = lower(${libelle}) and archive_le is null`;
  if (existant) return existant;
  const [cree] = await tx<{ id: string; validite_mois: number | null }[]>`
    insert into public.types_formation (libelle, validite_mois) values (${libelle}, ${validite})
    returning id, validite_mois`;
  return cree;
}

export async function creerFormation(formData: FormData): Promise<Resultat> {
  const { ok, donnees: d, erreur } = valider(schemaFormation, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer(async (tx) => {
    const agentId = d.agent_id ?? (await agentPour(tx, d.agent_nouveau!));
    const type = d.type_formation_id
      ? (
          await tx<{ id: string; validite_mois: number | null }[]>`
            select id, validite_mois from public.types_formation where id = ${d.type_formation_id} and archive_le is null`
        )[0]
      : await typePour(tx, d.type_nouveau!, d.validite_mois_nouveau);
    if (!type) throw new RefusMetier("Formation introuvable : rechargez la page.");
    await tx`insert into public.formations ${tx({
      agent_id: agentId,
      type_formation_id: type.id,
      date_formation: d.date_formation,
      duree_heures: d.duree_heures,
      organisme: d.organisme,
      echeance: d.echeance ?? calculerEcheance(d.date_formation, type.validite_mois),
      notes: d.notes,
    })}`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/formations");
}

export async function modifierFormation(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaModifFormation, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.formations set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/formations");
}

export async function archiverFormation(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.formations set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/formations");
}

// Référentiel : agents et types de formation.

export async function creerAgent(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaAgent, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.agents ${tx(donnees)}`);
  if (echec) return { erreur: doublon(echec) };
  rafraichir();
  return { message: "Agent ajouté." };
}

export async function modifierAgent(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaAgent, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.agents set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: doublon(echec) };
  rafraichir();
  return { message: "Enregistré." };
}

export async function archiverAgent(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.agents set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
}

export async function creerTypeFormation(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaTypeFormation, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`insert into public.types_formation ${tx(donnees)}`);
  if (echec) return { erreur: doublon(echec) };
  rafraichir();
  return { message: "Formation ajoutée." };
}

export async function modifierTypeFormation(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaTypeFormation, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.types_formation set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: doublon(echec) };
  rafraichir();
  return { message: "Enregistré. Les échéances déjà calculées ne changent pas." };
}

export async function archiverTypeFormation(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer(
    (tx) => tx`update public.types_formation set archive_le = now() where id = ${id}`,
    ADMIN,
  );
  if (echec) return { erreur: echec };
  rafraichir();
}
