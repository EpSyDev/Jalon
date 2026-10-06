import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signerSession, verifierSession } from "@/lib/session-locale";

const SECRET = "x".repeat(40);
const ID = "00000000-0000-4000-a000-000000000001";

describe("session locale", () => {
  it("accepte un jeton signé", () => {
    expect(verifierSession(signerSession(ID, SECRET), SECRET)).toBe(ID);
  });

  it("refuse un jeton falsifié, mal formé ou signé avec un autre secret", () => {
    const jeton = signerSession(ID, SECRET);
    expect(verifierSession(jeton.replace("0001", "0002"), SECRET)).toBeNull();
    expect(verifierSession(ID, SECRET)).toBeNull();
    expect(verifierSession(undefined, SECRET)).toBeNull();
    expect(verifierSession(signerSession(ID, "y".repeat(40)), SECRET)).toBeNull();
  });
});

describe("mode d'authentification local", () => {
  const BASE = { AUTH_MODE: "local", SECRET_SESSION_LOCALE: SECRET };

  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  async function charger(env: Record<string, string>) {
    for (const [cle, valeur] of Object.entries(env)) vi.stubEnv(cle, valeur);
    const { lireEnv } = await import("@/lib/env");
    return lireEnv;
  }

  it("est accepté sur une base locale", async () => {
    const lireEnv = await charger({ ...BASE, DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54329/postgres" });
    expect(lireEnv().AUTH_MODE).toBe("local");
  });

  it("est refusé avec une base distante", async () => {
    const lireEnv = await charger({
      ...BASE,
      DATABASE_URL: "postgres://u:p@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    });
    expect(() => lireEnv()).toThrow(/interdit/);
  });

  it("est refusé sur Vercel", async () => {
    const lireEnv = await charger({
      ...BASE,
      VERCEL: "1",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54329/postgres",
    });
    expect(() => lireEnv()).toThrow(/interdit/);
  });

  it("exige un secret de session suffisamment long", async () => {
    const lireEnv = await charger({
      ...BASE,
      SECRET_SESSION_LOCALE: "court",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54329/postgres",
    });
    expect(() => lireEnv()).toThrow();
  });
});

describe("nettoyage des variables d'environnement", () => {
  it.each([
    ["DATABASE_URL", "  postgres://u:p@h:6543/db \n", "postgres://u:p@h:6543/db"],
    ["DATABASE_URL", '"postgres://u:p@h:6543/db"', "postgres://u:p@h:6543/db"],
    ["DATABASE_URL", "DATABASE_URL=postgres://u:p@h:6543/db", "postgres://u:p@h:6543/db"],
    ["APP_URL", "'https://x.vercel.app'", "https://x.vercel.app"],
    ["CRON_SECRET", "abc", "abc"],
  ])("%s : %j", async (nom, saisie, attendu) => {
    const { nettoyerVariable } = await import("@/lib/env");
    expect(nettoyerVariable(nom, saisie)).toBe(attendu);
  });

  it("l'erreur de configuration ne révèle jamais la valeur saisie", async () => {
    vi.resetModules();
    vi.stubEnv("AUTH_MODE", "supabase");
    vi.stubEnv("DATABASE_URL", "mot-de-passe-secret-123");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "x".repeat(30));
    const { lireEnv } = await import("@/lib/env");
    expect(() => lireEnv()).toThrow(/DATABASE_URL : doit commencer par postgres/);
    try {
      lireEnv();
    } catch (e) {
      expect((e as Error).message).not.toContain("mot-de-passe-secret");
    }
    vi.unstubAllEnvs();
  });
});

describe("DATABASE_URL : caractères parasites", () => {
  it.each([
    "[postgresql://u:p@h:6543/db]",
    "“postgresql://u:p@h:6543/db”",
    "​postgresql://u:p@h:6543/db",
    "<postgresql://u:p@h:6543/db>",
  ])("%j", async (saisie) => {
    const { nettoyerVariable } = await import("@/lib/env");
    expect(nettoyerVariable("DATABASE_URL", saisie)).toBe("postgresql://u:p@h:6543/db");
  });

  it("ne touche pas à un mot de passe contenant des caractères spéciaux", async () => {
    const { nettoyerVariable } = await import("@/lib/env");
    expect(nettoyerVariable("DATABASE_URL", "postgresql://u:p%40ss]w>@h:6543/db")).toBe(
      "postgresql://u:p%40ss]w>@h:6543/db",
    );
  });
});

describe("DATABASE_URL sans schéma", () => {
  it.each([
    "/postgres.abcd:pw@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    "postgres.abcd:pw@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
  ])("%s", async (saisie) => {
    const { nettoyerVariable } = await import("@/lib/env");
    expect(nettoyerVariable("DATABASE_URL", saisie)).toBe(
      "postgresql://postgres.abcd:pw@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    );
  });

  it("laisse intacte une URL déjà complète", async () => {
    const { nettoyerVariable } = await import("@/lib/env");
    const url = "postgresql://postgres.abcd:pw@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";
    expect(nettoyerVariable("DATABASE_URL", url)).toBe(url);
  });
});
