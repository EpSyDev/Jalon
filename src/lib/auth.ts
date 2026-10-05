import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { creerClientSupabase } from "@/lib/supabase/serveur";

import type { Role } from "@/lib/roles";

export type Utilisateur = { id: string; nom: string; role: Role };

type Session = { utilisateur: Utilisateur | null; doitValider2fa: boolean };

const lireSession = cache(async (): Promise<Session> => {
  const supabase = await creerClientSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { utilisateur: null, doitValider2fa: false };

  const [{ data: profil }, { data: aal }] = await Promise.all([
    supabase.from("profils").select("id, nom, role").eq("id", data.claims.sub).is("archive_le", null).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!profil) return { utilisateur: null, doitValider2fa: false };

  const utilisateur = profil as Utilisateur;
  const enAal2 = aal?.currentLevel === "aal2";
  // Facteur enrôlé mais non validé dans cette session, ou admin sans 2FA : passage obligatoire.
  const doitValider2fa = !enAal2 && (aal?.nextLevel === "aal2" || utilisateur.role === "admin");
  return { utilisateur, doitValider2fa };
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
