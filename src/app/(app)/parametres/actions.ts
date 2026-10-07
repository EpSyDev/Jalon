"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requete } from "@/lib/auth";
import { messageErreurBase } from "@/lib/erreurs";
import { normaliserSeuils } from "@/lib/metier/rappels";
import { executerRappels } from "@/lib/rappels/executer";

type Resultat = { erreur: string } | { message: string } | undefined;

const schemaParametres = z.object({
  seuil_a_echeance_jours: z.coerce.number().int().min(1).max(365),
  seuils_rappel_jours: z
    .string()
    .transform((t) =>
      normaliserSeuils(
        t
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(Number),
      ),
    )
    .pipe(z.array(z.number()).min(1, "au moins un seuil").max(5, "5 seuils maximum")),
  destinataires_rappels: z
    .string()
    .transform((t) => [
      ...new Set(
        t
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((m) => m.toLowerCase()),
      ),
    ])
    .pipe(z.array(z.email("adresse mail invalide")).max(10, "10 destinataires maximum")),
  jour_recap_hebdo: z.coerce.number().int().min(1).max(7),
});

const LIBELLES: Record<string, string> = {
  seuil_a_echeance_jours: "Seuil « à échéance »",
  seuils_rappel_jours: "Seuils de rappel",
  destinataires_rappels: "Destinataires",
  jour_recap_hebdo: "Jour du récapitulatif",
};

export async function enregistrerParametres(formData: FormData): Promise<Resultat> {
  const saisie = schemaParametres.safeParse(Object.fromEntries(formData));
  if (!saisie.success) {
    const issue = saisie.error.issues[0];
    return { erreur: `${LIBELLES[String(issue.path[0])] ?? "Saisie"} : ${issue.message}` };
  }
  try {
    await requete(
      async (tx) => {
        for (const [cle, valeur] of Object.entries(saisie.data)) {
          await tx`update public.parametres set valeur = ${tx.json(valeur)} where cle = ${cle}`;
        }
      },
      ["admin"],
    );
  } catch (e) {
    unstable_rethrow(e);
    return { erreur: messageErreurBase(e) };
  }
  revalidatePath("/", "layout");
  return { message: "Paramètres enregistrés." };
}

const schemaRole = z.object({ id: z.uuid(), role: z.enum(["admin", "technicien", "lecture", "desactive"]) });

export async function changerRole(formData: FormData): Promise<Resultat> {
  const saisie = schemaRole.safeParse(Object.fromEntries(formData));
  if (!saisie.success) return { erreur: "Saisie invalide." };
  const { id, role } = saisie.data;
  try {
    const refus = await requete(
      async (tx) => {
        // Garde-fou : il doit toujours rester au moins un administrateur actif.
        if (role !== "admin") {
          const [{ n }] = await tx<{ n: number }[]>`
          select count(*)::int as n from public.profils where role = 'admin' and archive_le is null and id <> ${id}`;
          if (n === 0) return "Impossible : ce compte est le dernier administrateur actif.";
        }
        if (role === "desactive") {
          await tx`update public.profils set archive_le = now() where id = ${id} and archive_le is null`;
        } else {
          await tx`update public.profils set role = ${role}, archive_le = null where id = ${id}`;
        }
        return null;
      },
      ["admin"],
    );
    if (refus) return { erreur: refus };
  } catch (e) {
    unstable_rethrow(e);
    return { erreur: messageErreurBase(e) };
  }
  revalidatePath("/parametres");
  return { message: "Accès mis à jour." };
}

export async function lancerRappels(): Promise<Resultat> {
  try {
    await requete(async () => undefined, ["admin"]);
    const bilan = await executerRappels();
    revalidatePath("/parametres", "layout");
    return bilan.statut === "envoye" || bilan.statut === "rien"
      ? { message: bilan.message }
      : { erreur: bilan.message };
  } catch (e) {
    unstable_rethrow(e);
    console.error("Rappels manuels en échec :", (e as Error).message);
    return { erreur: "Échec de l'exécution des rappels (configuration mail ?)." };
  }
}
