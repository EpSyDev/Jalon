import Link from "next/link";
import { requete } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { reservesOuvertes } from "@/lib/requetes/controles";
import { ListeReserves } from "./liste-reserves";

export const metadata = { title: "Réserves ouvertes — Jalon" };

export default async function PageReserves() {
  const { reserves, peutEcrire } = await requete(async (tx, u) => ({
    reserves: await reservesOuvertes(tx),
    peutEcrire: u.role !== "lecture",
  }));
  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <Link href="/controles" className="text-sm text-muted-foreground underline">
        ← Contrôles
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Réserves ouvertes ({reserves.length})</h1>
        <p className="text-sm text-muted-foreground">
          Filtrez, cochez, puis levez plusieurs réserves d&apos;un coup (ex. vigilances d&apos;une campagne de
          maintenance traitées). Chaque levée reste visible et réversible sur la fiche de la réserve.
        </p>
      </div>
      <ListeReserves reserves={reserves} peutEcrire={peutEcrire} aujourdhui={aujourdhuiParis()} />
    </div>
  );
}
