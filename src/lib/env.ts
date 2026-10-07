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

/**
 * Variable d'environnement nettoyée des erreurs de copier-coller courantes : espaces, retours à la ligne,
 * guillemets, préfixe « NOM= ». Ne modifie jamais le contenu utile.
 */
export function nettoyerVariable(nom: string, valeur: string | undefined): string | undefined {
  if (valeur === undefined) return undefined;
  let v = valeur.trim();
  if (v.toUpperCase().startsWith(`${nom}=`)) v = v.slice(nom.length + 1).trim();
  const guillemet = v[0];
  if (v.length > 1 && (guillemet === '"' || guillemet === "'") && v.endsWith(guillemet)) v = v.slice(1, -1).trim();
  if (nom === "DATABASE_URL") {
    // Caractères parasites collés autour de l'URL : crochets, guillemets typographiques, caractères invisibles.
    const debut = /postgres(?:ql)?:\/\//i.exec(v);
    if (debut && debut.index > 0 && debut.index <= 3) v = v.slice(debut.index);
    v = v.replace(/[\s"'`“”‘’>\])}​-‏⁠﻿]+$/u, "");
    // Schéma oublié : « /postgres.<ref>:mot-de-passe@hôte:6543/postgres » → on rétablit « postgresql:// ».
    if (!v.includes("://") && /^\/{0,2}postgres(\.[a-z0-9]+)?:[^@\s]+@[^\s/]+/i.test(v)) {
      v = `postgresql://${v.replace(/^\/+/, "")}`;
    }
  }
  return v;
}

const lire = (nom: string) => nettoyerVariable(nom, process.env[nom]);

/** Diagnostic lisible, sans jamais afficher la valeur (elle peut contenir un mot de passe). */
function diagnostic(e: z.ZodError): Error {
  // Règles globales (sans champ) : leur message est écrit par nous, donc sûr à afficher.
  const regles = e.issues.filter((i) => i.path.length === 0).map((i) => i.message);
  if (regles.length) return new Error(regles.join(" "));
  const champs = [...new Set(e.issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);
  const detail = champs
    .map((c) => {
      const brut = process.env[c];
      if (brut === undefined || brut === "") return `${c} : absente ou vide`;
      if (c === "DATABASE_URL") {
        // Indice sûr : uniquement le début alphabétique (« https », « psql »…), jamais la suite (mot de passe).
        const propre = brut.trim();
        const debut = /^[a-z]{1,12}/i.exec(propre)?.[0];
        const premier = `U+${(propre.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
        const position = propre.toLowerCase().indexOf("postgres");
        return `DATABASE_URL : doit commencer par postgres:// ou postgresql:// (valeur de ${brut.length} caractères ; premier caractère ${premier}${debut ? `, début « ${debut} »` : ""} ; « postgres » ${position < 0 ? "absent" : `à la position ${position}`})`;
      }
      if (c === "SUPABASE_URL") return "SUPABASE_URL : doit être une adresse https://… valide";
      return `${c} : format invalide`;
    })
    .join(" ; ");
  return new Error(`Configuration invalide — ${detail || "variables d'environnement"}.`);
}

let cache: Env | undefined;

export function lireEnv(): Env {
  if (cache) return cache;
  const saisie = schema.safeParse({
    AUTH_MODE: lire("AUTH_MODE") ?? "supabase",
    DATABASE_URL: lire("DATABASE_URL"),
    SUPABASE_URL: lire("SUPABASE_URL"),
    SUPABASE_PUBLISHABLE_KEY: lire("SUPABASE_PUBLISHABLE_KEY"),
    SECRET_SESSION_LOCALE: lire("SECRET_SESSION_LOCALE"),
  });
  if (!saisie.success) throw diagnostic(saisie.error);
  cache = saisie.data;
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

/**
 * Secret du cron seul : la route doit pouvoir authentifier l'appel (et toucher la base, ce qui évite la mise
 * en pause de Supabase) même quand les mails ne sont pas encore configurés.
 */
export function lireSecretCron(): string {
  const secret = lire("CRON_SECRET");
  if (!secret || secret.length < 32) throw new Error("CRON_SECRET absent ou trop court (32 caractères minimum).");
  return secret;
}

export function lireEnvRappels(): EnvRappels {
  const saisie = schemaRappels.safeParse({
    CRON_SECRET: lire("CRON_SECRET"),
    APP_URL: lire("APP_URL")?.replace(/\/+$/, ""),
    MAIL_MODE: lire("MAIL_MODE") ?? "local",
    RESEND_API_KEY: lire("RESEND_API_KEY") || undefined,
    MAIL_EXPEDITEUR: lire("MAIL_EXPEDITEUR") || undefined,
  });
  if (!saisie.success) {
    const champs = [...new Set(saisie.error.issues.map((i) => String(i.path[0] || "MAIL_MODE")))].join(", ");
    throw new Error(`Configuration des rappels invalide — vérifiez : ${champs}.`);
  }
  return saisie.data;
}
