import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { historiqueFormation, lireFormation } from "@/lib/requetes/formations";
import { archiverFormation, modifierFormation } from "../actions";
import { ChampsFormation } from "../champs-formation";

export const metadata = { title: "Formation — Jalon" };

export default async function PageFormation({ params }: PageProps<"/formations/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(
    async (tx, u) => {
      const formation = await lireFormation(tx, id);
      if (!formation) return null;
      const historique = await historiqueFormation(tx, formation.agent_id, formation.type_formation_id);
      return { formation, historique, role: u.role };
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { formation, historique, role } = donnees;

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/formations" className="text-sm text-muted-foreground underline">
        ← Formations
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{formation.type_libelle}</h1>
        <p className="text-muted-foreground">{formation.agent_nom}</p>
      </div>
      <LienBouton
        href={`/formations/nouvelle?agent=${formation.agent_id}&type=${formation.type_formation_id}`}
        variante="outline"
      >
        Renouveler (nouvelle session)
      </LienBouton>
      <Formulaire action={modifierFormation.bind(null, id)} libelle="Enregistrer">
        <ChampsFormation formation={formation} aujourdhui={aujourdhuiParis()} />
      </Formulaire>

      {historique.length > 1 && (
        <section className="grid gap-2 border-t pt-4">
          <h2 className="text-lg font-semibold">Historique</h2>
          <ul className="grid gap-1.5 text-sm">
            {historique.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/formations/${h.id}`}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <span className={h.id === id ? "font-medium" : undefined}>{formaterDate(h.date_formation)}</span>
                  <span className="text-muted-foreground">
                    {h.echeance ? `valable jusqu'au ${formaterDate(h.echeance)}` : "sans échéance"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {role === "admin" && (
        <div className="grid gap-3 border-t pt-4">
          <Formulaire
            action={archiverFormation.bind(null, id)}
            libelle="Archiver cette formation"
            variante="outline"
            confirmation="Archiver cette formation (saisie par erreur par exemple) ?"
          />
        </div>
      )}
    </div>
  );
}
