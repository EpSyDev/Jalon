import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireContact, optionsPrestataires } from "@/lib/requetes/contacts";
import { archiverContact, modifierContact } from "../../actions";
import { ChampsContact } from "../../champs-contact";

export const metadata = { title: "Modifier le contact — Jalon" };

export default async function PageModifierContact({ params }: PageProps<"/contacts/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const contact = await lireContact(tx, id);
      return contact ? { contact, prestataires: await optionsPrestataires(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/contacts/${id}`} className="text-sm text-muted-foreground underline">
        ← {donnees.contact.nom}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le contact</h1>
      <Formulaire action={modifierContact.bind(null, id)} libelle="Enregistrer">
        <ChampsContact contact={donnees.contact} prestataires={donnees.prestataires} />
      </Formulaire>
      {donnees.role === "admin" && (
        <Formulaire
          action={archiverContact.bind(null, id)}
          libelle="Archiver ce contact"
          variante="destructive"
          confirmation="Archiver ce contact ?"
        />
      )}
    </div>
  );
}
