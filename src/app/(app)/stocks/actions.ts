"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN, executer, ID_INVALIDE, idsValides, valider, type Resultat } from "@/lib/actions";
import { schemaArticle, schemaMouvement } from "@/lib/metier/stocks";

const LIBELLES: Record<string, string> = {
  reference: "Référence",
  libelle: "Libellé",
  unite: "Unité",
  seuil_alerte: "Seuil d'alerte",
  notes: "Notes",
  sens: "Sens",
  quantite: "Quantité",
  date_mouvement: "Date",
  commentaire: "Commentaire",
};

const rafraichir = () => revalidatePath("/stocks", "layout");
const doublon = (m: string) => m.replace("Cet élément existe déjà.", "Cette référence d'article existe déjà.");

export async function creerArticle(formData: FormData): Promise<Resultat> {
  const { ok, donnees, erreur } = valider(schemaArticle, formData, LIBELLES);
  if (!ok) return { erreur };
  let id = "";
  const echec = await executer(async (tx) => {
    [{ id }] = await tx<{ id: string }[]>`insert into public.articles_stock ${tx(donnees)} returning id`;
  });
  if (echec) return { erreur: doublon(echec) };
  rafraichir();
  redirect(`/stocks/${id}`);
}

export async function modifierArticle(id: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaArticle, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer((tx) => tx`update public.articles_stock set ${tx(donnees)} where id = ${id}`);
  if (echec) return { erreur: doublon(echec) };
  rafraichir();
  redirect(`/stocks/${id}`);
}

export async function archiverArticle(id: string): Promise<Resultat> {
  if (!idsValides(id)) return ID_INVALIDE;
  const echec = await executer((tx) => tx`update public.articles_stock set archive_le = now() where id = ${id}`, ADMIN);
  if (echec) return { erreur: echec };
  rafraichir();
  redirect("/stocks");
}

export async function enregistrerMouvement(articleId: string, formData: FormData): Promise<Resultat> {
  if (!idsValides(articleId)) return ID_INVALIDE;
  const { ok, donnees, erreur } = valider(schemaMouvement, formData, LIBELLES);
  if (!ok) return { erreur };
  const echec = await executer(
    (tx) => tx`insert into public.mouvements_stock ${tx({ ...donnees, article_id: articleId })}`,
  );
  if (echec) return { erreur: echec };
  rafraichir();
  return { message: donnees.sens === "entree" ? "Entrée enregistrée." : "Sortie enregistrée." };
}

/** Retire un mouvement saisi par erreur (admin, tracé). */
export async function archiverMouvement(articleId: string, mouvementId: string): Promise<Resultat> {
  if (!idsValides(articleId, mouvementId)) return ID_INVALIDE;
  const echec = await executer(
    (tx) => tx`update public.mouvements_stock set archive_le = now() where id = ${mouvementId}`,
    ADMIN,
  );
  if (echec) return { erreur: echec };
  rafraichir();
}
