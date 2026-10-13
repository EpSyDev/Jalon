import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { Formulaire } from "@/components/formulaire";
import { titreContact } from "@/lib/metier/contacts";
import { requete } from "@/lib/auth";
import { lireContact, optionsPrestataires } from "@/lib/requetes/contacts";
import { archiverContact, supprimerContact, modifierContact } from "../../actions";
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
        ← {titreContact(donnees.contact)}
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le contact</h1>
      <Formulaire action={modifierContact.bind(null, id)} libelle="Enregistrer">
        <ChampsContact contact={donnees.contact} prestataires={donnees.prestataires} />
      </Formulaire>
      {donnees.role === "admin" && (
        <div className="grid gap-3 border-t pt-4">
          <Formulaire
            action={archiverContact.bind(null, id)}
            libelle="Archiver ce contact"
            variante="outline"
            confirmation="Archiver ce contact ?"
          />
          <BoutonSupprimer action={supprimerContact.bind(null, id)} nom="ce contact" />
        </div>
      )}
    </div>
  );
}
