import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lirePlan, optionsPlan } from "@/lib/requetes/controles";
import { archiverPlan, modifierPlan } from "../../../actions";
import { ChampsPlan } from "../../champs-plan";

export const metadata = { title: "Modifier le plan — Jalon" };

export default async function PageModifierPlan({ params }: PageProps<"/controles/plans/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const donnees = await requete(
    async (tx, u) => {
      const plan = await lirePlan(tx, id);
      return plan && !plan.archive_le ? { plan, options: await optionsPlan(tx), role: u.role } : null;
    },
    ["admin", "technicien"],
  );
  if (!donnees) notFound();
  const { plan, options, role } = donnees;
  // L'équipement actuel peut être réformé (absent des choix) : le conserver pour ne pas perdre le lien.
  if (plan.equipement_id && !options.equipements.some((e) => e.id === plan.equipement_id)) {
    options.equipements.unshift({
      id: plan.equipement_id,
      libelle: `${plan.equipement_code} — ${plan.equipement_libelle} (réformé)`,
    });
  }

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4 md:p-8">
      <Link href={`/controles/plans/${plan.id}`} className="text-sm text-muted-foreground underline">
        ← Retour à la fiche
      </Link>
      <h1 className="text-2xl font-semibold">Modifier le plan</h1>
      <Formulaire action={modifierPlan.bind(null, plan.id)} libelle="Enregistrer">
        <ChampsPlan options={options} plan={plan} />
      </Formulaire>
      {role === "admin" && (
        <Formulaire
          action={archiverPlan.bind(null, plan.id)}
          libelle="Archiver ce plan"
          variante="destructive"
          confirmation="Archiver ce plan ? Il ne générera plus d'échéance ni d'alerte. L'historique est conservé."
        />
      )}
    </div>
  );
}
