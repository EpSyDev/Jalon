import { describe, expect, it } from "vitest";
import { lienTelephone, schemaContact } from "@/lib/metier/contacts";

describe("contacts", () => {
  it("normalise les champs vides et met l'adresse en minuscules", () => {
    expect(
      schemaContact.parse({ nom: " Jean Dupont ", organisation: "", email: "Jean@Exemple.FR", telephone: "" }),
    ).toMatchObject({
      nom: "Jean Dupont",
      organisation: null,
      email: "jean@exemple.fr",
      telephone: null,
      prestataire_id: null,
    });
  });

  it("refuse un nom vide, un mail ou un téléphone invalides", () => {
    expect(schemaContact.safeParse({ nom: "" }).success).toBe(false);
    expect(schemaContact.safeParse({ nom: "A", email: "pas-un-mail" }).success).toBe(false);
    expect(schemaContact.safeParse({ nom: "A", telephone: "appeler moi" }).success).toBe(false);
  });

  it("lien d'appel : chiffres et + seulement", () => {
    expect(lienTelephone("+33 (0)4 66 12 34 56")).toBe("tel:+330466123456");
  });
});
