import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { lireEnv } from "@/lib/env";

/** Client Supabase Auth (mode « supabase » uniquement). Les données passent par lib/db. */
export async function creerClientSupabase() {
  const env = lireEnv();
  if (env.AUTH_MODE !== "supabase") throw new Error("Supabase Auth n'est pas utilisé en mode local.");
  const magasin = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => magasin.getAll(),
      setAll: (aEcrire) => {
        try {
          aEcrire.forEach(({ name, value, options }) => magasin.set(name, value, options));
        } catch {
          // Appel depuis un Server Component : le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
}
