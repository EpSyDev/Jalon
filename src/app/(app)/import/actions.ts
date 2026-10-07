"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requete } from "@/lib/auth";
import { messageErreurBase } from "@/lib/erreurs";
import { lireFichier, TAILLE_MAX } from "@/lib/import/fichier";
import { z } from "zod";
import {
  lireTableau,
  type Correspondance,
  type DemandeCorrespondance,
  planifierControles,
  planifierEquipements,
  type LigneApercu,
  type TypeImport,
} from "@/lib/metier/import";
import { executerControles, executerEquipements, lireExistant } from "@/lib/requetes/import";

export type Apercu = {
  lignes: LigneApercu[];
  importable: boolean;
  creations: string[];
};

export type ReponseImport =
  | { erreur: string; demande?: DemandeCorrespondance }
  | { apercu: Apercu; importe?: never; erreur?: never }
  | { importe: string; apercu?: never; erreur?: never };

const schemaCorrespondance = z.record(z.string().max(40), z.number().int().min(0).max(500).nullable());

/** Correspondance choisie par l'utilisateur (JSON validé), ou undefined pour la détection automatique. */
function lireCorrespondance(brut: FormDataEntryValue | null): Correspondance | undefined | "invalide" {
  if (typeof brut !== "string" || brut === "") return undefined;
  try {
    const r = schemaCorrespondance.safeParse(JSON.parse(brut));
    return r.success ? r.data : "invalide";
  } catch {
    return "invalide";
  }
}

const ECRITURE = ["admin", "technicien"] as const;

async function preparer(formData: FormData) {
  const type = formData.get("type");
  const fichier = formData.get("fichier");
  if (type !== "controles" && type !== "equipements") return { erreur: "Type d'import inconnu." };
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisissez un fichier." };
  if (fichier.size > TAILLE_MAX) return { erreur: "Fichier trop volumineux (5 Mo maximum)." };
  const { tableau, erreur } = await lireFichier(fichier.name, Buffer.from(await fichier.arrayBuffer()));
  if (erreur || !tableau) return { erreur: erreur ?? "Fichier illisible." };
  const correspondance = lireCorrespondance(formData.get("correspondance"));
  if (correspondance === "invalide") return { erreur: "Correspondance de colonnes invalide." };
  const lu = lireTableau(tableau, type as TypeImport, correspondance);
  if (lu.erreur) return { erreur: lu.erreur, demande: lu.demande };
  return { type: type as TypeImport, lignes: lu.lignes };
}

type Operations =
  ReturnType<typeof planifierControles>["operations"] | ReturnType<typeof planifierEquipements>["operations"];

/** Nombre + libellé accordé : compter(2, "plan", "plans"). */
const compter = (n: number, singulier: string, pluriel: string) => `${n} ${n > 1 ? pluriel : singulier}`;

function resumeCreations(ops: Operations): string[] {
  const r: string[] = [];
  if (ops.familles.length)
    r.push(`${compter(ops.familles.length, "famille", "familles")} : ${ops.familles.join(", ")}`);
  if ("plans" in ops) {
    if (ops.prestataires.length) {
      r.push(`${compter(ops.prestataires.length, "prestataire", "prestataires")} : ${ops.prestataires.join(", ")}`);
    }
    if (ops.types.length) r.push(compter(ops.types.length, "type de contrôle", "types de contrôle"));
    r.push(compter(ops.plans.length, "plan de contrôle", "plans de contrôle"));
    const repris = ops.plans.filter((x) => x.dernier).length;
    if (repris) r.push(compter(repris, "dernier contrôle repris", "derniers contrôles repris"));
  } else {
    if (ops.univers.length) r.push(`${compter(ops.univers.length, "univers", "univers")} : ${ops.univers.join(", ")}`);
    if (ops.localisations.length) r.push(compter(ops.localisations.length, "localisation", "localisations"));
    r.push(compter(ops.equipements.length, "équipement", "équipements"));
  }
  return r;
}

export async function analyserImport(formData: FormData): Promise<ReponseImport> {
  const prepare = await preparer(formData);
  if ("erreur" in prepare) return { erreur: prepare.erreur!, demande: prepare.demande };
  try {
    return await requete(
      async (tx) => {
        const existant = await lireExistant(tx);
        const plan =
          prepare.type === "controles"
            ? planifierControles(prepare.lignes!, existant)
            : planifierEquipements(prepare.lignes!, existant);
        return {
          apercu: {
            lignes: plan.lignes,
            importable: plan.importable,
            creations: plan.importable ? resumeCreations(plan.operations) : [],
          },
        };
      },
      [...ECRITURE],
    );
  } catch (e) {
    unstable_rethrow(e);
    return { erreur: messageErreurBase(e) };
  }
}

/** Réanalyse le fichier puis importe tout, dans une seule transaction (tout ou rien). */
export async function importer(formData: FormData): Promise<ReponseImport> {
  const prepare = await preparer(formData);
  if ("erreur" in prepare) return { erreur: prepare.erreur!, demande: prepare.demande };
  try {
    const bilan = await requete(
      async (tx) => {
        const existant = await lireExistant(tx);
        if (prepare.type === "controles") {
          const plan = planifierControles(prepare.lignes!, existant);
          if (!plan.importable) return null;
          const r = await executerControles(tx, plan.operations);
          return `Import terminé : ${compter(r.plans, "plan de contrôle", "plans de contrôle")}, ${compter(r.types, "type", "types")}, ${compter(r.controles, "dernier contrôle", "derniers contrôles")}.`;
        }
        const plan = planifierEquipements(prepare.lignes!, existant);
        if (!plan.importable) return null;
        const r = await executerEquipements(tx, plan.operations);
        return `Import terminé : ${compter(r.equipements, "équipement", "équipements")}, ${compter(r.univers, "univers créé", "univers créés")}, ${compter(r.localisations, "localisation", "localisations")}.`;
      },
      [...ECRITURE],
    );
    if (!bilan) return { erreur: "Les données ont changé depuis l'aperçu : relancez l'analyse." };
    revalidatePath("/", "layout");
    return { importe: bilan };
  } catch (e) {
    unstable_rethrow(e);
    return { erreur: messageErreurBase(e) };
  }
}
