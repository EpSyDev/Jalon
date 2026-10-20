import Link from "next/link";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { referentielFormations } from "@/lib/requetes/formations";
import { creerFormation } from "../actions";
import { ChampsAgentType, ChampsFormation } from "../champs-formation";

export const metadata = { title: "Nouvelle formation — Jalon" };

const uuidOuRien = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : undefined);

export default async function PageNouvelleFormation({ searchParams }: PageProps<"/formations/nouvelle">) {
  const { agent, type } = await searchParams;
  const { agents, types } = await requete((tx) => referentielFormations(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href="/formations" className="text-sm text-muted-foreground underline">
        ← Formations
      </Link>
      <h1 className="text-2xl font-semibold">Formation suivie</h1>
      <Formulaire action={creerFormation} libelle="Enregistrer la formation">
        <ChampsAgentType agents={agents} types={types} agentId={uuidOuRien(agent)} typeId={uuidOuRien(type)} />
        <ChampsFormation />
      </Formulaire>
    </div>
  );
}
