import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lireEnv } from "@/lib/env";

const ROUTES_PUBLIQUES = ["/connexion"];

function politiqueCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
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

  // Rafraîchit la session Supabase (cookies) à chaque requête.
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = lireEnv();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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

  const chemin = request.nextUrl.pathname;
  const publique = ROUTES_PUBLIQUES.some((r) => chemin === r || chemin.startsWith(`${r}/`));
  if (!data?.claims && !publique) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
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
