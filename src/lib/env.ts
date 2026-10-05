import "server-only";
import { z } from "zod";

// Variables serveur uniquement : aucune n'est exposée au navigateur (pas de NEXT_PUBLIC_).
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

let cache: z.infer<typeof schema> | undefined;

export function lireEnv() {
  cache ??= schema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
  return cache;
}
