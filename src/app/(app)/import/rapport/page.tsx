import { FormulaireRapport } from "./formulaire-rapport";

export const metadata = { title: "Rapport PDF — Jalon" };

export default function PageRapport() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Lire un rapport de contrôle (PDF)</h1>
        <p className="text-muted-foreground">
          Jalon lit le texte du rapport et pré-remplit la saisie : date, référence, équipements et avis. Rien n&apos;est
          enregistré avant votre validation. Le PDF est lu sur le serveur de Jalon puis oublié : il n&apos;est ni stocké
          ni envoyé à un service extérieur.
        </p>
        <p className="text-sm text-muted-foreground">
          Reconnus aujourd&apos;hui : les rapports Bureau Veritas de vérification périodique (récapitulatif des fiches).
          Les réserves détaillées ne sont pas encore lues : saisissez-les ci-dessous. Un PDF scanné (image) ne peut pas
          être lu.
        </p>
      </div>
      <FormulaireRapport />
    </div>
  );
}
