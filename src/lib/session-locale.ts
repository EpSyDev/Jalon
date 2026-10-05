// Session du mode de développement local (sans Supabase Auth) : cookie signé HMAC.
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESSION_LOCALE = "jalon_session_locale";

function signature(valeur: string, secret: string): string {
  return createHmac("sha256", secret).update(valeur).digest("base64url");
}

export function signerSession(utilisateurId: string, secret: string): string {
  return `${utilisateurId}.${signature(utilisateurId, secret)}`;
}

/** Renvoie l'id utilisateur si la signature est valide, sinon null. */
export function verifierSession(jeton: string | undefined, secret: string): string | null {
  if (!jeton) return null;
  const point = jeton.lastIndexOf(".");
  if (point <= 0) return null;
  const id = jeton.slice(0, point);
  const recue = Buffer.from(jeton.slice(point + 1));
  const attendue = Buffer.from(signature(id, secret));
  return recue.length === attendue.length && timingSafeEqual(recue, attendue) ? id : null;
}
