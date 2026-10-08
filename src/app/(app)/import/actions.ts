"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requete } from "@/lib/auth";
import { messageErreurBase } from "@/lib/erreurs";
import { lireFichier, TAILLE_MAX } from "@/lib/import/fichier";
import { z } from "zod";
import {
  lireTableau,
  type DemandeCorrespondance,
  type LigneBrute,
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

/** Association des colonnes d'une feuille (feuille null : fichier à une seule feuille, ou CSV). */
export type DemandeFeuille = { feuille: string | null; demande: DemandeCorrespondance };

export type ReponseImport =
  | { erreur: string; demandes?: DemandeFeuille[]; feuilles?: string[] }
  | { apercu: Apercu; demandes: DemandeFeuille[]; importe?: never; erreur?: never }
  | { importe: string; apercu?: never; erreur?: never; demandes?: never };

/** Association choisie pour chaque feuille (clé "" sans feuille) : JSON validé, absent = détection automatique. */
const schemaAssociations = z.record(
  z.string().max(100),
  z.object({
    correspondance: z.record(z.string().max(40), z.number().int().min(0).max(500).nullable()).optional(),
    exclues: z.array(z.number().int().min(0).max(500)).max(500).optional(),
  }),
);
type Associations = z.infer<typeof schemaAssociations>;

function lireAssociations(brut: FormDataEntryValue | null): Associations | "invalide" {
  if (typeof brut !== "string" || brut === "") return {};
  try {
    const r = schemaAssociations.safeParse(JSON.parse(brut));
    return r.success ? r.data : "invalide";
  } catch {
    return "invalide";
  }
}

const schemaMaintenance = z.object({
  libelle: z.string().trim().min(1, "Libellé du contrôle de maintenance manquant.").max(200),
  famille: z.string().trim().min(1, "Famille du contrôle de maintenance manquante.").max(120),
  caractere: z.enum(["reglementaire", "obligatoire", "interne"]),
  periodiciteMois: z.coerce.number().int().min(1).max(120, "Périodicité de maintenance : de 1 à 120 mois."),
  conformeSansVigilance: z.boolean(),
});

const ECRITURE = ["admin", "technicien"] as const;

const texteDe = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

async function preparer(formData: FormData) {
  const type = formData.get("type");
  const fichier = formData.get("fichier");
  if (type !== "controles" && type !== "equipements") return { erreur: "Type d'import inconnu." };
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisissez un fichier." };
  if (fichier.size > TAILLE_MAX) return { erreur: "Fichier trop volumineux (5 Mo maximum)." };
  const choisies = formData
    .getAll("feuille")
    .filter((f): f is string => typeof f === "string" && f !== "" && f.length <= 100)
    .slice(0, 50);
  const { tableaux, erreur, feuilles } = await lireFichier(
    fichier.name,
    Buffer.from(await fichier.arrayBuffer()),
    choisies,
  );
  if (erreur || !tableaux) return { erreur: erreur ?? "Fichier illisible.", feuilles };
  const associations = lireAssociations(formData.get("associations"));
  if (associations === "invalide") return { erreur: "Association des colonnes invalide." };

  // Options propres aux équipements : univers commun, codes générés, bâtiment, familles de section, maintenances.
  const equipements = type === "equipements";
  const prefixe = texteDe(formData.get("prefixe_code"));
  if (equipements && prefixe !== "" && !PREFIXE_CODE_VALIDE.test(prefixe)) {
    return { erreur: "Préfixe de code invalide : 20 caractères maximum, sans espace ni / \\ ? #." };
  }
  const universBrut = formData.get("univers_defaut");
  const universParDefaut =
    equipements && typeof universBrut === "string" && z.uuid().safeParse(universBrut).success ? universBrut : null;
  const batiment = texteDe(formData.get("batiment_defaut"));
  if (equipements && batiment.length > 120) return { erreur: "Bâtiment : 120 caractères maximum." };
  let maintenance: OptionsEquipements["maintenance"] = null;
  if (equipements && formData.get("maintenance") === "on") {
    const m = schemaMaintenance.safeParse({
      libelle: texteDe(formData.get("maint_libelle")),
      famille: texteDe(formData.get("maint_famille")),
      caractere: formData.get("maint_caractere"),
      periodiciteMois: formData.get("maint_periodicite"),
      conformeSansVigilance: formData.get("maint_conforme") === "on",
    });
    if (!m.success) return { erreur: m.error.issues[0]?.message ?? "Options de maintenance invalides." };
    maintenance = m.data;
  }
  const options: OptionsEquipements = {
    prefixeCode: equipements && prefixe !== "" ? prefixe : null,
    universParDefaut,
    batimentParDefaut: equipements && batiment !== "" ? batiment : null,
    titresFamille: equipements && formData.get("titres_famille") === "on",
    maintenance,
  };

  // Chaque feuille est lue avec sa propre association ; les lignes sont ensuite planifiées ensemble
  // (codes générés continus, n° de série en double repérés d'une feuille à l'autre).
  const demandes: DemandeFeuille[] = [];
  const lignes: LigneBrute[] = [];
  const erreurs: string[] = [];
  for (const { feuille, tableau } of tableaux) {
    const assoc = associations[feuille ?? ""];
    const lu = lireTableau(tableau, type as TypeImport, assoc?.correspondance, {
      codeAuto: options.prefixeCode !== null,
      exclues: assoc?.exclues,
    });
    if (lu.demande) demandes.push({ feuille, demande: lu.demande });
    if (lu.erreur) erreurs.push(feuille ? `Feuille « ${feuille} » : ${lu.erreur}` : lu.erreur);
    else lignes.push(...lu.lignes!.map((l) => (feuille ? { ...l, feuille } : l)));
  }
  if (erreurs.length) return { erreur: erreurs.join(" "), demandes };
  return { type: type as TypeImport, lignes, demandes, options };
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
    if (ops.types.length) r.push(`type de contrôle : ${ops.types[0].libelle} (${ops.types[0].periodicite_mois} mois)`);
    if (ops.maintenances.length) {
      const controles = ops.maintenances.flatMap((m) => m.controles);
      const reserves = controles.reduce((n, c) => n + c.reserves.length, 0);
      r.push(compter(ops.maintenances.length, "plan de maintenance", "plans de maintenance"));
      r.push(compter(controles.length, "maintenance reprise en contrôle", "maintenances reprises en contrôles"));
      if (reserves) r.push(compter(reserves, "réserve ouverte", "réserves ouvertes"));
    }
  }
  return r;
}

export async function analyserImport(formData: FormData): Promise<ReponseImport> {
  const prepare = await preparer(formData);
  if ("erreur" in prepare) return { erreur: prepare.erreur!, demandes: prepare.demandes, feuilles: prepare.feuilles };
  try {
    return await requete(
      async (tx) => {
        const existant = await lireExistant(tx);
        const plan =
          prepare.type === "controles"
            ? planifierControles(prepare.lignes, existant)
            : planifierEquipements(prepare.lignes, existant, prepare.options);
        if (
          prepare.options.universParDefaut &&
          !existant.univers.some((u) => u.id === prepare.options.universParDefaut)
        ) {
          return { erreur: "L'univers choisi n'existe plus : rechargez la page." };
        }
        return {
          apercu: {
            lignes: plan.lignes,
            importable: plan.importable,
            creations: plan.importable ? resumeCreations(plan.operations) : [],
          },
          demandes: prepare.demandes,
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
  if ("erreur" in prepare) return { erreur: prepare.erreur!, demandes: prepare.demandes, feuilles: prepare.feuilles };
  try {
    const bilan = await requete(
      async (tx) => {
        const existant = await lireExistant(tx);
        if (prepare.type === "controles") {
          const plan = planifierControles(prepare.lignes, existant);
          if (!plan.importable) return null;
          const r = await executerControles(tx, plan.operations);
          return `Import terminé : ${compter(r.plans, "plan de contrôle", "plans de contrôle")}, ${compter(r.types, "type", "types")}, ${compter(r.controles, "dernier contrôle", "derniers contrôles")}.`;
        }
        const plan = planifierEquipements(prepare.lignes, existant, prepare.options);
        if (!plan.importable) return null;
        const r = await executerEquipements(tx, plan.operations);
        const maintenances = r.plans
          ? `, ${compter(r.plans, "plan de maintenance", "plans de maintenance")}, ${compter(r.controles, "maintenance reprise", "maintenances reprises")}, ${compter(r.reserves, "réserve ouverte", "réserves ouvertes")}`
          : "";
        return `Import terminé : ${compter(r.equipements, "équipement", "équipements")}, ${compter(r.univers, "univers créé", "univers créés")}, ${compter(r.localisations, "localisation", "localisations")}${maintenances}.`;
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
