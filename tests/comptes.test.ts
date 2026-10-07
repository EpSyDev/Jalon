import { describe, expect, it } from "vitest";
import { messageMotDePasse, schemaLien, schemaMotDePasse } from "@/lib/metier/comptes";

describe("lien reçu par mail", () => {
  it("n'accepte que l'invitation et la réinitialisation", () => {
    expect(schemaLien.safeParse({ token_hash: "pkce_abc123def456", type: "invite" }).success).toBe(true);
    expect(schemaLien.safeParse({ token_hash: "abc123def456", type: "recovery" }).success).toBe(true);
    for (const type of ["magiclink", "email_change", "signup", undefined]) {
      expect(schemaLien.safeParse({ token_hash: "abc123def456", type }).success).toBe(false);
    }
  });

  it("refuse un jeton tronqué ou contenant autre chose que des caractères sûrs", () => {
    expect(schemaLien.safeParse({ token_hash: "abc", type: "invite" }).success).toBe(false);
    expect(schemaLien.safeParse({ token_hash: "abc123def456<script>", type: "invite" }).success).toBe(false);
  });
});

describe("mot de passe", () => {
  it("12 à 72 caractères, confirmation identique", () => {
    expect(schemaMotDePasse.safeParse({ motDePasse: "court", confirmation: "court" }).success).toBe(false);
    expect(schemaMotDePasse.safeParse({ motDePasse: "x".repeat(73), confirmation: "x".repeat(73) }).success).toBe(
      false,
    );
    const r = schemaMotDePasse.safeParse({ motDePasse: "cheval agrafe pile", confirmation: "cheval agrafe pole" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirmation"]);
    expect(
      schemaMotDePasse.safeParse({ motDePasse: "cheval agrafe pile", confirmation: "cheval agrafe pile" }).success,
    ).toBe(true);
  });

  it("messages Supabase traduits, générique sinon", () => {
    expect(messageMotDePasse("same_password")).toMatch(/différent/);
    expect(messageMotDePasse("insufficient_aal")).toMatch(/double authentification/);
    expect(messageMotDePasse("inconnu")).toMatch(/Réessayez/);
  });
});
