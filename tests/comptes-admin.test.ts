import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLE = "cle-service-role-de-test-1234567890";

describe("création de compte par un administrateur", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AUTH_MODE", "supabase");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@h:6543/db");
    vi.stubEnv("SUPABASE_URL", "https://projet.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "x".repeat(30));
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", CLE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const compte = { email: "a@ex.fr", nom: "Alice", motDePasse: "provisoire-1234567890" };

  it("appelle l'API d'administration avec la clé en en-têtes, adresse confirmée, nom en métadonnées", async () => {
    const fetchSimule = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "uuid-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSimule);
    const { creerCompteAuth } = await import("@/lib/supabase/admin");
    expect(await creerCompteAuth(compte)).toEqual({ id: "uuid-1" });
    const [url, init] = fetchSimule.mock.calls[0];
    expect(url).toBe("https://projet.supabase.co/auth/v1/admin/users");
    expect(init.headers).toMatchObject({ apikey: CLE, Authorization: `Bearer ${CLE}` });
    expect(JSON.parse(init.body)).toEqual({
      email: "a@ex.fr",
      password: "provisoire-1234567890",
      email_confirm: true,
      user_metadata: { nom: "Alice" },
    });
  });

  it("messages lisibles, sans jamais journaliser la clé ni le mot de passe", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const repondre = (statut: number, corps: object) =>
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(corps), { status: statut })));
    const { creerCompteAuth } = await import("@/lib/supabase/admin");

    repondre(422, { error_code: "email_exists" });
    expect((await creerCompteAuth(compte)).erreur).toMatch(/existe déjà/);
    repondre(401, {});
    expect((await creerCompteAuth(compte)).erreur).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    repondre(500, {});
    expect((await creerCompteAuth(compte)).erreur).toMatch(/Réessayez/);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    expect((await creerCompteAuth(compte)).erreur).toMatch(/injoignable/);

    const journal = JSON.stringify(erreur.mock.calls);
    expect(journal).not.toContain(CLE);
    expect(journal).not.toContain(compte.motDePasse);
  });

  it("sans clé de service, la création n'est pas proposée", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { creationDeComptesDisponible, creerCompteAuth } = await import("@/lib/supabase/admin");
    expect(creationDeComptesDisponible()).toBe(false);
    expect((await creerCompteAuth(compte)).erreur).toMatch(/non configurée/);
  });

  it("mots de passe provisoires : 24 caractères, différents à chaque fois", async () => {
    const { motDePasseProvisoire } = await import("@/lib/supabase/admin");
    const a = motDePasseProvisoire();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(motDePasseProvisoire()).not.toBe(a);
  });
});
