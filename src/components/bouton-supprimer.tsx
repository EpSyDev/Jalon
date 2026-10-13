import { Formulaire } from "@/components/formulaire";

type Action = (formData: FormData) => Promise<{ erreur: string } | { message: string } | undefined | void>;

/** Suppression définitive (administrateur) : confirmation obligatoire, en plus de l'archivage proposé à côté. */
export function BoutonSupprimer({ action, nom, className }: { action: Action; nom: string; className?: string }) {
  return (
    <Formulaire
      action={action}
      libelle="Supprimer définitivement"
      libelleEnCours="Suppression…"
      variante="destructive"
      className={className}
      confirmation={`Supprimer définitivement ${nom} ? Cette action est irréversible (elle reste tracée au journal). En cas de doute, archivez plutôt.`}
    />
  );
}
