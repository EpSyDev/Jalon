import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rappel permanent : aucune donnée patient ne doit être saisie dans l'outil. */
export function RappelDonneesPatient({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted-foreground", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Aucune donnée patient, y compris dans les commentaires.
    </p>
  );
}
