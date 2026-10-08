"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requete } from "@/lib/auth";
import { messageErreurBase } from "@/lib/erreurs";
import { lireTextePdf, TAILLE_MAX_PDF } from "@/lib/import/pdf";
import { GRAVITES, incoherenceResultat, RESULTATS } from "@/lib/metier/controles";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { masquerNoms } from "@/lib/metier/noms";
import { lireRapport, type RapportLu } from "@/lib/metier/rapport-pdf";
import { dateIso, dateOptionnelle, texteOptionnel } from "@/lib/metier/saisie";
import { rapprocher, type PlanChoix, type Rapprochement } from "@/lib/requetes/rapport";

const ECRITURE = ["admin", "technicien"] as const;

export type Lecture =
  | { erreur: string }
  | { rapport: RapportLu; fichier: string; plans: PlanChoix[]; rapprochements: Rapprochement[]; erreur?: never };

/** Lit le PDF en mémoire (jamais stocké) et propose de quoi pré-remplir les contrôles. */
export async function lireRapportPdf(formData: FormData): Promise<Lecture> {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisissez un fichier PDF." };
  if (fichier.size > TAILLE_MAX_PDF) return { erreur: "PDF trop volumineux (10 Mo maximum)." };
  const { pages, erreur } = await lireTextePdf(new Uint8Array(await fichier.arrayBuffer()));
  if (!pages) return { erreur: erreur ?? "PDF illisible." };
  const rapport = lireRapport(pages);
  try {
    const { plans, rapprochements } = await requete((tx) => rapprocher(tx, rapport.fiches), [...ECRITURE]);
    return { rapport, fichier: masquerNoms(fichier.name).slice(0, 200), plans, rapprochements };
  } catch (e) {
    unstable_rethrow(e);
    return { erreur: messageErreurBase(e) };
  }
}

const schemaReserveSaisie = z.object({
  description: z.string().trim().min(1, "description de réserve obligatoire").max(2000),
  gravite: z.enum(GRAVITES).nullable(),
  echeance_levee: dateOptionnelle,
});

const schemaControleRapport = z
  .object({
    plan_controle_id: z.uuid("choisissez le contrôle concerné"),
    date_realisation: dateIso.refine((d) => d <= aujourdhuiParis(), "date dans le futur"),
    resultat: z.enum(RESULTATS, "résultat à choisir"),
    nb_reserves_declare: z.number().int().min(0).max(500),
    commentaire: texteOptionnel(2000),
    reserves: z.array(schemaReserveSaisie).max(500),
  })
  .superRefine((c, ctx) => {
    const n = Math.max(c.nb_reserves_declare, c.reserves.length);
    const erreur = incoherenceResultat(c.resultat, n);
    if (erreur) ctx.addIssue({ code: "custom", message: erreur, path: ["resultat"] });
  });

const schemaEnregistrement = z.object({
  reference_rapport: texteOptionnel(500),
  controles: z.array(schemaControleRapport).min(1, "aucun contrôle à enregistrer").max(50),
});

export type SaisieRapport = z.input<typeof schemaEnregistrement>;

/** Enregistre les contrôles validés par l'utilisateur, avec leurs réserves, en une seule transaction. */
export async function enregistrerRapport(saisie: SaisieRapport): Promise<{ erreur: string } | { message: string }> {
  const lu = schemaEnregistrement.safeParse(saisie);
  if (!lu.success) {
    const issue = lu.error.issues[0];
    const rang =
      issue.path[0] === "controles" && typeof issue.path[1] === "number" ? `Contrôle ${issue.path[1] + 1} : ` : "";
    return { erreur: `${rang}${issue.message}` };
  }
  const { reference_rapport, controles } = lu.data;
  try {
    await requete(
      async (tx) => {
        for (const c of controles) {
          const nb = Math.max(c.nb_reserves_declare, c.reserves.length);
          const [{ id }] = await tx<{ id: string }[]>`
          insert into public.controles ${tx({
            plan_controle_id: c.plan_controle_id,
            date_realisation: c.date_realisation,
            resultat: c.resultat,
            nb_reserves_declare: nb,
            reference_rapport,
            commentaire: c.commentaire ? masquerNoms(c.commentaire) : null,
          })} returning id`;
          const detaillees = c.reserves.map((r) => ({
            controle_id: id,
            date_constat: c.date_realisation,
            description: masquerNoms(r.description),
            gravite: r.gravite,
            echeance_levee: r.echeance_levee,
          }));
          if (detaillees.length) await tx`insert into public.reserves ${tx(detaillees)}`;
          // Réserves annoncées mais non détaillées : « à détailler », pour ne pas les oublier.
          if (nb > detaillees.length) {
            await tx`
            insert into public.reserves (controle_id, date_constat)
            select ${id}, ${c.date_realisation}::date from generate_series(1, ${nb - detaillees.length})`;
          }
        }
      },
      [...ECRITURE],
    );
  } catch (e) {
    unstable_rethrow(e);
    return { erreur: messageErreurBase(e) };
  }
  revalidatePath("/controles", "layout");
  revalidatePath("/");
  const n = controles.length;
  return { message: `${n} contrôle${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""} depuis le rapport.` };
}
