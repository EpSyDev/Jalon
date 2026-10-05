"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sqlBrut } from "@/lib/db";
import { lireEnv } from "@/lib/env";
import { cheminSur } from "@/lib/metier/parc";
import { COOKIE_SESSION_LOCALE, signerSession } from "@/lib/session-locale";
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
  redirect(cheminSur(formData.get("suite")));
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
  if (lireEnv().AUTH_MODE === "local") {
    (await cookies()).delete(COOKIE_SESSION_LOCALE);
  } else {
    const supabase = await creerClientSupabase();
    await supabase.auth.signOut();
  }
  redirect("/connexion");
}

/** Mode local uniquement : connexion sans mot de passe sur un compte fictif. */
export async function connexionLocale(formData: FormData) {
  const env = lireEnv();
  if (env.AUTH_MODE !== "local") throw new Error("Connexion locale indisponible.");
  const id = z.uuid().parse(formData.get("utilisateurId"));
  const [profil] = await sqlBrut()`select id from public.profils where id = ${id} and archive_le is null`;
  if (!profil) redirect("/connexion");
  (await cookies()).set(COOKIE_SESSION_LOCALE, signerSession(id, env.SECRET_SESSION_LOCALE), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(cheminSur(formData.get("suite")));
}
