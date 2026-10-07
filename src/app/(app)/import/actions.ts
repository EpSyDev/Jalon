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
  PREFIXE_CODE_VALIDE,
  type OptionsEquipements,
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
  | { erreur: string; demande?: DemandeCorrespondance; feuilles?: string[] }
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
  const feuille = formData.get("feuille");
  const { tableau, erreur, feuilles } = await lireFichier(
    fichier.name,
    Buffer.from(await fichier.arrayBuffer()),
    typeof feuille === "string" && feuille !== "" && feuille.length <= 100 ? feuille : undefined,
  );
  if (erreur || !tableau) return { erreur: erreur ?? "Fichier illisible.", feuilles };
  const correspondance = lireCorrespondance(formData.get("correspondance"));
  if (correspondance === "invalide") return { erreur: "Correspondance de colonnes invalide." };

  // Options propres aux équipements : univers commun à toutes les lignes, codes générés.
  const prefixe =
    typeof formData.get("prefixe_code") === "string" ? (formData.get("prefixe_code") as string).trim() : "";
  if (type === "equipements" && prefixe !== "" && !PREFIXE_CODE_VALIDE.test(prefixe)) {
    return { erreur: "Préfixe de code invalide : 20 caractères maximum, sans espace ni / \ ? #." };
  }
  const universBrut = formData.get("univers_defaut");
  const universParDefaut =
    type === "equipements" && typeof universBrut === "string" && z.uuid().safeParse(universBrut).success
      ? universBrut
      : null;
  const options: OptionsEquipements = {
    prefixeCode: type === "equipements" && prefixe !== "" ? prefixe : null,
    universParDefaut,
  };

  const lu = lireTableau(tableau, type as TypeImport, correspondance, { codeAuto: options.prefixeCode !== null });
  if (lu.erreur) return { erreur: lu.erreur, demande: lu.demande };
  return { type: type as TypeImport, lignes: lu.lignes, options };
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
            : planifierEquipements(prepare.lignes!, existant, prepare.options);
        if (
          prepare.options?.universParDefaut &&
          !existant.univers.some((u) => u.id === prepare.options?.universParDefaut)
        ) {
          return { erreur: "L'univers choisi n'existe plus : rechargez la page." };
        }
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
        const plan = planifierEquipements(prepare.lignes!, existant, prepare.options);
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
