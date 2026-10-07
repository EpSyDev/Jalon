"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, valider, type Resultat } from "@/lib/actions";
import { schemaContact } from "@/lib/metier/contacts";

const LIBELLES: Record<string, string> = {
  nom: "Nom",
  organisation: "Organisation",
  fonction: "Fonction",
  telephone: "Téléphone",
  email: "Adresse mail",
  notes: "Notes",
  prestataire_id: "Prestataire",
};

const rafraichir = () => revalidatePath("/contacts", "layout");

export async function creerContact(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaContact, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.contacts ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/contacts/${id}`);
}

export async function modifierContact(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaContact, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.contacts set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect(`/contacts/${id}`);
}

export async function archiverContact(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.contacts set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/contacts");
}
