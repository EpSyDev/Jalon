"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { creerClientSupabase } from "@/lib/supabase/serveur";

export type EtatFormulaire = { erreur: string | null };

const schemaConnexion = z.object({
  email: z.email().max(254),
  motDePasse: z.string().min(1).max(200),
});

export async function seConnecter(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const saisie = schemaConnexion.safeParse({ email: formData.get("email"), motDePasse: formData.get("motDePasse") });
  if (!saisie.success) return { erreur: "Adresse mail ou mot de passe invalide." };

  const supabase = await creerClientSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
  });
  // Message volontairement générique : ne pas révéler si le compte existe.
  if (error) return { erreur: "Identifiants incorrects ou trop de tentatives. Réessayez." };
  redirect("/");
}

const schemaCode = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export async function validerCode2fa(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const saisie = schemaCode.safeParse({ factorId: formData.get("factorId"), code: formData.get("code") });
  if (!saisie.success) return { erreur: "Le code doit contenir 6 chiffres." };

  const supabase = await creerClientSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify(saisie.data);
  if (error) return { erreur: "Code incorrect ou expiré." };
  redirect("/");
}

export async function seDeconnecter() {
  const supabase = await creerClientSupabase();
  await supabase.auth.signOut();
  redirect("/connexion");
}
