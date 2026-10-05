import "server-only";
import { z } from "zod";

// Variables serveur uniquement : aucune n'est exposée au navigateur (pas de NEXT_PUBLIC_).
const schema = z
  .discriminatedUnion("AUTH_MODE", [
    z.object({
      AUTH_MODE: z.literal("supabase"),
      DATABASE_URL: z.string().startsWith("postgres"),
      SUPABASE_URL: z.url(),
      SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    }),
    z.object({
      AUTH_MODE: z.literal("local"),
      DATABASE_URL: z.string().startsWith("postgres"),
      SECRET_SESSION_LOCALE: z.string().min(32),
    }),
  ])
  .refine((e) => e.AUTH_MODE === "supabase" || (!process.env.VERCEL && estBaseLocale(e.DATABASE_URL)), {
    message: "Le mode d'authentification local est interdit hors poste de développement.",
  });

function estBaseLocale(url: string): boolean {
  const hote = new URL(url).hostname;
  return hote === "127.0.0.1" || hote === "localhost";
}

export type Env = z.infer<typeof schema>;

let cache: Env | undefined;

export function lireEnv(): Env {
  cache ??= schema.parse({
    AUTH_MODE: process.env.AUTH_MODE ?? "supabase",
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SECRET_SESSION_LOCALE: process.env.SECRET_SESSION_LOCALE,
  });
  return cache;
}
