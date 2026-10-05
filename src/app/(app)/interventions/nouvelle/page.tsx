import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { optionsIntervention } from "@/lib/requetes/interventions";
import { creerIntervention } from "../actions";
import { ChampsIntervention } from "../champs-intervention";

export const metadata = { title: "Nouvelle intervention — Jalon" };

export default async function PageNouvelleIntervention({ searchParams }: PageProps<"/interventions/nouvelle">) {
  const params = await searchParams;
  const options = await requete((tx) => optionsIntervention(tx), ["admin", "technicien"]);
  // Pré-remplissage depuis une fiche (équipement, plan, chantier) : uniquement des valeurs existantes.
  const choisir = (valeur: unknown, liste: { id: string }[]) => liste.find((o) => o.id === valeur)?.id;
  const defauts = {
    equipement_id: choisir(params.equipement, options.equipements),
    plan_controle_id: choisir(params.plan, options.plans),
    chantier_id: choisir(params.chantier, options.chantiers),
  };

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Nouvelle intervention</h1>
      <Formulaire action={creerIntervention} libelle="Créer l'intervention">
        <ChampsIntervention options={options} defauts={defauts} />
      </Formulaire>
    </div>
  );
}
