"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerPremierFacteur } from "@/lib/auth";
import { sqlBrut } from "@/lib/db";
import { lireEnv } from "@/lib/env";
import { adresseIp, limiteAtteinte, noterEchec, type Cle } from "@/lib/limitation";
import { cheminSur } from "@/lib/metier/parc";
import { COOKIE_SESSION_LOCALE, signerSession } from "@/lib/session-locale";
import { creerClientSupabase } from "@/lib/supabase/serveur";

export type EtatFormulaire = { erreur: string | null };

const TROP_DE_TENTATIVES = "Trop de tentatives. Patientez 15 minutes avant de réessayer.";

const schemaConnexion = z.object({
  email: z.email().max(254),
  motDePasse: z.string().min(1).max(200),
});

export async function seConnecter(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const saisie = schemaConnexion.safeParse({ email: formData.get("email"), motDePasse: formData.get("motDePasse") });
  if (!saisie.success) return { erreur: "Adresse mail ou mot de passe invalide." };

  const cles: Cle[] = [
    { nature: "email", valeur: saisie.data.email },
    { nature: "ip", valeur: await adresseIp() },
  ];
  if (await limiteAtteinte(cles)) return { erreur: TROP_DE_TENTATIVES };

  const supabase = await creerClientSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
  });
  if (error) {
    // Journal serveur : code technique seulement (jamais l'adresse ni le mot de passe).
    console.error(`Connexion refusée : statut=${error.status ?? "?"} code=${error.code ?? "?"} nom=${error.name}`);
    // Cas qui ne révèlent rien sur l'existence d'un compte (le mot de passe était correct, ou c'est un incident technique).
    if (error.code === "email_not_confirmed") {
      return { erreur: "Compte non confirmé : demandez à un administrateur de le confirmer dans Supabase." };
    }
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return { erreur: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
    }
    if (!error.status || error.status >= 500 || error.code === "invalid_api_key" || error.status === 401) {
      return { erreur: "Service d'authentification indisponible ou mal configuré. Contactez l'administrateur." };
    }
    // Message volontairement générique pour le reste : ne pas révéler si le compte existe.
    await noterEchec(cles);
    return { erreur: "Identifiants incorrects ou trop de tentatives. Réessayez." };
  }
  redirect(cheminSur(formData.get("suite")));
}

const schemaCode = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export async function validerCode2fa(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const saisie = schemaCode.safeParse({ factorId: formData.get("factorId"), code: formData.get("code") });
  if (!saisie.success) return { erreur: "Le code doit contenir 6 chiffres." };

  const utilisateur = await exigerPremierFacteur();
  const cles: Cle[] = [{ nature: "code2fa", valeur: utilisateur.id }];
  if (await limiteAtteinte(cles)) return { erreur: TROP_DE_TENTATIVES };

  const supabase = await creerClientSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify(saisie.data);
  if (error) {
    await noterEchec(cles);
    return { erreur: "Code incorrect ou expiré." };
  }
  redirect(cheminSur(formData.get("suite")));
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
