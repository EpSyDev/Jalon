"use client";

import { Formulaire } from "@/components/formulaire";
import { resoudreTache, rouvrirTache } from "./actions";

/** « Résolue » en une touche : la tâche reste rouvrable depuis la liste des résolues. */
export function BoutonResoudre({ id }: { id: string }) {
  return <Formulaire action={resoudreTache.bind(null, id)} libelle="Résolue" libelleEnCours="…" className="shrink-0" />;
}

export function BoutonRouvrir({ id }: { id: string }) {
  return (
    <Formulaire
      action={rouvrirTache.bind(null, id)}
      libelle="Rouvrir"
      libelleEnCours="…"
      variante="outline"
      className="shrink-0"
    />
  );
}
