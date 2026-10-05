import { PageSquelette } from "@/components/page-squelette";
import { exigerUtilisateur } from "@/lib/auth";

export default async function PageAujourdhui() {
  const { nom } = await exigerUtilisateur();
  return (
    <PageSquelette
      titre={`Bonjour ${nom}`}
      bloc="B2"
      description="Aujourd'hui : retards, échéances à venir, réserves ouvertes, interventions urgentes et contrats arrivant à terme, classés par priorité."
    />
  );
}
