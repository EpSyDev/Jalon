import { Badge } from "@/components/ui/badge";
import { LIBELLES_STATUT } from "@/lib/format";
import type { StatutEcheance } from "@/lib/metier/echeance";
import { cn } from "@/lib/utils";

const STYLE_STATUT: Record<StatutEcheance, string> = {
  en_retard: "bg-red-600 text-white dark:bg-red-500",
  jamais_controle: "bg-violet-600 text-white dark:bg-violet-500",
  a_echeance: "bg-amber-400 text-black",
  a_jour: "bg-emerald-600 text-white dark:bg-emerald-500",
};

export function BadgeStatut({ statut }: { statut: StatutEcheance | null }) {
  if (!statut) return <Badge variant="outline">Inactif</Badge>;
  return <Badge className={cn("border-transparent", STYLE_STATUT[statut])}>{LIBELLES_STATUT[statut]}</Badge>;
}

export function BadgeReserves({ ouvertes }: { ouvertes: number }) {
  if (ouvertes === 0) return null;
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
      {ouvertes} réserve{ouvertes > 1 ? "s" : ""} ouverte{ouvertes > 1 ? "s" : ""}
    </Badge>
  );
}
