import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireType, listerFamilles } from "@/lib/requetes/controles";
import { archiverType, modifierType } from "../../actions";
import { ChampsType } from "../champs-type";

export const metadata = { title: "Modifier le type — Jalon" };

export default async function PageModifierType({ params }: PageProps<"/controles/types/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const donnees = await requete(
    async (tx, u) => {
      const type = await lireType(tx, id);
      return type ? { type, familles: await listerFamilles(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { type, familles, role } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/controles/types" className="text-sm text-muted-foreground underline">
        ← Types de contrôle
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le type</h1>
      <p className="rounded-md bg-muted p-3 text-sm">
        Changer la périodicité recalcule immédiatement l&apos;échéance de tous les plans de ce type (sauf ceux ayant une
        périodicité spécifique).
      </p>
      <Formulaire action={modifierType.bind(null, type.id)} libelle="Enregistrer">
        <ChampsType familles={familles} type={type} />
      </Formulaire>
      {role === "admin" && (
        <Formulaire
          action={archiverType.bind(null, type.id)}
          libelle="Archiver ce type"
          variante="destructive"
          confirmation="Archiver ce type de contrôle ?"
        />
      )}
    </div>
  );
}
