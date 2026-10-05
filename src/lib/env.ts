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

// --- Rappels mail et cron (lus uniquement par le cron et la page Paramètres) ---

const schemaRappels = z
  .object({
    CRON_SECRET: z.string().min(32, "CRON_SECRET : 32 caractères minimum"),
    APP_URL: z.url(),
    MAIL_MODE: z.enum(["local", "resend"]),
    RESEND_API_KEY: z.string().min(10).optional(),
    MAIL_EXPEDITEUR: z.string().min(3).optional(),
  })
  .refine((e) => e.MAIL_MODE === "local" || (e.RESEND_API_KEY && e.MAIL_EXPEDITEUR), {
    message: "MAIL_MODE=resend exige RESEND_API_KEY et MAIL_EXPEDITEUR.",
  })
  .refine((e) => e.MAIL_MODE === "resend" || !process.env.VERCEL, {
    message: "Les mails locaux (fichiers) sont interdits sur Vercel.",
  });

export type EnvRappels = z.infer<typeof schemaRappels>;

export function lireEnvRappels(): EnvRappels {
  return schemaRappels.parse({
    CRON_SECRET: process.env.CRON_SECRET,
    APP_URL: process.env.APP_URL,
    MAIL_MODE: process.env.MAIL_MODE ?? "local",
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    MAIL_EXPEDITEUR: process.env.MAIL_EXPEDITEUR || undefined,
  });
}
