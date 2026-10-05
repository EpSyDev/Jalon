import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { avecUtilisateur, type Identite, type Tx } from "@/lib/db";
import { lireEnv } from "@/lib/env";
import type { Role } from "@/lib/roles";
import { COOKIE_SESSION_LOCALE, verifierSession } from "@/lib/session-locale";
import { creerClientSupabase } from "@/lib/supabase/serveur";

export type Utilisateur = Identite & { nom: string; role: Role };

type Session = { identite: Identite | null; doitValider2fa: boolean };

async function lireIdentite(): Promise<Session> {
  const env = lireEnv();
  if (env.AUTH_MODE === "local") {
    const id = verifierSession((await cookies()).get(COOKIE_SESSION_LOCALE)?.value, env.SECRET_SESSION_LOCALE);
    // Pas de 2FA en local : considéré comme validé.
    return { identite: id ? { id, aal: "aal2" } : null, doitValider2fa: false };
  }

  const supabase = await creerClientSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { identite: null, doitValider2fa: false };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const enAal2 = aal?.currentLevel === "aal2";
  return {
    identite: { id: data.claims.sub, aal: enAal2 ? "aal2" : "aal1" },
    doitValider2fa: !enAal2 && aal?.nextLevel === "aal2",
  };
}

const lireSession = cache(async () => {
  const { identite, doitValider2fa } = await lireIdentite();
  if (!identite) return { utilisateur: null, doitValider2fa: false };

  const [profil] = await avecUtilisateur(
    identite,
    (tx) => tx<{ nom: string; role: Role }[]>`
      select nom, role from public.profils where id = ${identite.id} and archive_le is null`,
  );
  if (!profil) return { utilisateur: null, doitValider2fa: false };

  const utilisateur: Utilisateur = { ...identite, ...profil };
  // Admin sans 2FA validée : passage obligatoire (la base ne lui accorde de toute façon que la lecture).
  return { utilisateur, doitValider2fa: doitValider2fa || (profil.role === "admin" && identite.aal !== "aal2") };
});

/** Exige un utilisateur connecté (et 2FA si requise). Redirige sinon. */
export async function exigerUtilisateur(rolesAutorises?: Role[]): Promise<Utilisateur> {
  const { utilisateur, doitValider2fa } = await lireSession();
  if (!utilisateur) redirect("/connexion");
  if (doitValider2fa) redirect("/connexion/2fa");
  if (rolesAutorises && !rolesAutorises.includes(utilisateur.role)) redirect("/");
  return utilisateur;
}

/** Pour la page 2FA : utilisateur connecté au premier facteur. */
export async function exigerPremierFacteur(): Promise<Utilisateur> {
  const { utilisateur, doitValider2fa } = await lireSession();
  if (!utilisateur) redirect("/connexion");
  if (!doitValider2fa) redirect("/");
  return utilisateur;
}

/** Raccourci : exige un utilisateur puis exécute fn sous son identité (RLS). */
export async function requete<T>(fn: (tx: Tx, utilisateur: Utilisateur) => Promise<T>, roles?: Role[]): Promise<T> {
  const utilisateur = await exigerUtilisateur(roles);
  return avecUtilisateur(utilisateur, (tx) => fn(tx, utilisateur));
}
