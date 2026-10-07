import "server-only";
import { randomBytes } from "node:crypto";
import { lireCleServiceRole, lireEnv } from "@/lib/env";

// Création de comptes par un administrateur (page Paramètres). Seule utilisation de la clé service_role en dehors du
// cron : réservée à cette action, déclenchée par un admin ayant validé sa 2FA, jamais exposée au navigateur.

export type CompteCree = { id: string; erreur?: never } | { erreur: string; id?: never };

/** Mot de passe provisoire : 24 caractères aléatoires, affiché une seule fois à l'administrateur. */
export function motDePasseProvisoire(): string {
  return randomBytes(18).toString("base64url");
}

/** Vrai si l'application peut créer des comptes (mode local, ou clé service_role renseignée). */
export function creationDeComptesDisponible(): boolean {
  return lireEnv().AUTH_MODE === "local" || Boolean(lireCleServiceRole());
}

/** Crée le compte dans Supabase Auth (adresse confirmée d'office). Le profil « lecture » naît par trigger. */
export async function creerCompteAuth(c: { email: string; nom: string; motDePasse: string }): Promise<CompteCree> {
  const env = lireEnv();
  const cle = lireCleServiceRole();
  if (env.AUTH_MODE !== "supabase" || !cle) return { erreur: "Création de comptes non configurée." };
  let reponse: Response;
  try {
    reponse = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: c.email,
        password: c.motDePasse,
        email_confirm: true,
        user_metadata: { nom: c.nom },
      }),
    });
  } catch {
    return { erreur: "Service d'authentification injoignable. Réessayez." };
  }
  if (reponse.ok) {
    const { id } = (await reponse.json()) as { id?: string };
    return id ? { id } : { erreur: "Réponse inattendue du service d'authentification." };
  }
  // Jamais le corps de la réponse ni la clé dans les journaux : seulement le statut et le code.
  const corps = (await reponse.json().catch(() => ({}))) as { error_code?: string };
  console.error(`Création de compte refusée : statut=${reponse.status} code=${corps.error_code ?? "?"}`);
  if (corps.error_code === "email_exists") return { erreur: "Un compte existe déjà avec cette adresse." };
  if (corps.error_code === "weak_password") return { erreur: "Mot de passe refusé par le service d'authentification." };
  if (reponse.status === 401 || reponse.status === 403) {
    return { erreur: "Clé de service refusée : vérifiez SUPABASE_SERVICE_ROLE_KEY sur Vercel." };
  }
  return { erreur: "Création impossible pour le moment. Réessayez." };
}
