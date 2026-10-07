import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lireEnv } from "@/lib/env";
import { COOKIE_SESSION_LOCALE } from "@/lib/session-locale";

// /api/cron : pas de session, protégé par CRON_SECRET dans la route elle-même.
const ROUTES_PUBLIQUES = ["/connexion", "/api/cron"];

function politiqueCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // En dev, l'outillage Next injecte des styles inline ; la production reste stricte.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // Attributs style (barres des graphiques, largeur des titres) : sans cela ils sont ignorés en production.
    // Les balises <style> restent soumises au nonce.
    ...(dev ? [] : ["style-src-attr 'unsafe-inline'"]),
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politiqueCsp(nonce);
  const entetes = new Headers(request.headers);
  entetes.set("x-nonce", nonce);
  entetes.set("Content-Security-Policy", csp);

  let reponse = NextResponse.next({ request: { headers: entetes } });

  const env = lireEnv();
  let connecte: boolean;
  if (env.AUTH_MODE === "local") {
    // Vérification optimiste ; la signature est contrôlée côté serveur (lib/auth).
    connecte = request.cookies.has(COOKIE_SESSION_LOCALE);
  } else {
    // Rafraîchit la session Supabase (cookies) à chaque requête.
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (aEcrire, entetesCache) => {
          aEcrire.forEach(({ name, value }) => request.cookies.set(name, value));
          reponse = NextResponse.next({ request: { headers: entetes } });
          aEcrire.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
          Object.entries(entetesCache).forEach(([cle, valeur]) => reponse.headers.set(cle, valeur));
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    connecte = Boolean(data?.claims);
  }

  const chemin = request.nextUrl.pathname;
  const publique = ROUTES_PUBLIQUES.some((r) => chemin === r || chemin.startsWith(`${r}/`));
  if (!connecte && !publique) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = chemin === "/" ? "" : `?suite=${encodeURIComponent(chemin + request.nextUrl.search)}`;
    reponse = NextResponse.redirect(url);
  }

  reponse.headers.set("Content-Security-Policy", csp);
  return reponse;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
