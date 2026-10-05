import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { lireEnv } from "@/lib/env";

/** Client Supabase lié à la session de l'utilisateur : la RLS s'applique. */
export async function creerClientSupabase() {
  const magasin = await cookies();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = lireEnv();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
