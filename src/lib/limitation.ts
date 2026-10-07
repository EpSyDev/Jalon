import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { avecServiceRole } from "@/lib/db";

// Limitation des échecs de connexion, de code 2FA et de demandes « mot de passe oublié ».
// Seules des empreintes sont stockées (schéma prive, migration 20261007000100), purgées après un jour.

export const LIMITES = {
  email: { max: 5, minutes: 15 },
  ip: { max: 30, minutes: 15 },
  code2fa: { max: 5, minutes: 15 },
  oubli: { max: 3, minutes: 60 },
} as const;

export type Cle = { nature: keyof typeof LIMITES; valeur: string };

export function empreinte({ nature, valeur }: Cle): string {
  return createHash("sha256").update(`${nature}:${valeur.trim().toLowerCase()}`).digest("hex");
}

/** Adresse IP du client. Sur Vercel, ces en-têtes sont réécrits par la plateforme (non falsifiables). */
export async function adresseIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
}

/**
 * Vrai si l'une des clés a atteint sa limite. En cas d'incident (migration non appliquée, base indisponible),
 * on laisse passer : Supabase Auth applique de toute façon ses propres limites, et l'on ne bloque pas l'accès.
 */
export async function limiteAtteinte(cles: Cle[]): Promise<boolean> {
  try {
    return await avecServiceRole(async (tx) => {
      for (const c of cles) {
        const { max, minutes } = LIMITES[c.nature];
        const [{ atteinte }] = await tx<{ atteinte: boolean }[]>`
          select prive.limite_atteinte(${empreinte(c)}, ${max}, ${minutes}) as atteinte`;
        if (atteinte) return true;
      }
      return false;
    });
  } catch (e) {
    console.error("Limitation des tentatives indisponible :", (e as { code?: string }).code ?? "?");
    return false;
  }
}

export async function noterEchec(cles: Cle[]): Promise<void> {
  try {
    await avecServiceRole(async (tx) => {
      for (const c of cles) await tx`select prive.noter_echec(${empreinte(c)})`;
    });
  } catch (e) {
    console.error("Limitation des tentatives indisponible :", (e as { code?: string }).code ?? "?");
  }
}
