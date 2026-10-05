import { ShieldAlert } from "lucide-react";

/** Rappel permanent : aucune donnée patient ne doit être saisie dans l'outil. */
export function RappelDonneesPatient() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Aucune donnée patient, y compris dans les commentaires.
    </p>
  );
}
