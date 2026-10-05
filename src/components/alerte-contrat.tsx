import { Badge } from "@/components/ui/badge";
import { formaterDate } from "@/lib/format";
import { limitePreavis, type AlerteContrat } from "@/lib/metier/contrats";
import { cn } from "@/lib/utils";

type ContratAlerte = { date_fin: string | null; preavis_jours: number | null; reconduction_tacite: boolean };

/** Phrase explicative de l'alerte (jamais d'affirmation juridique : l'outil ne certifie rien). */
export function messageAlerteContrat(c: ContratAlerte, alerte: AlerteContrat): string {
  if (!c.date_fin) return "";
  const limite = formaterDate(limitePreavis(c.date_fin, c.preavis_jours));
  const fin = formaterDate(c.date_fin);
  switch (alerte) {
    case "echu":
      return `Échu le ${fin} : mettre à jour la date de fin ou archiver`;
    case "preavis_depasse":
      return c.reconduction_tacite
        ? `Préavis dépassé le ${limite} (reconduction tacite prévue au contrat) · fin le ${fin}`
        : `Préavis dépassé le ${limite} · fin le ${fin}`;
    case "a_decider":
      return c.preavis_jours ? `Préavis à donner avant le ${limite} · fin le ${fin}` : `Fin le ${fin}`;
  }
}

const LIBELLES: Record<AlerteContrat, string> = {
  echu: "Échu",
  preavis_depasse: "Préavis dépassé",
  a_decider: "Décision à prendre",
};

export function BadgeAlerteContrat({ alerte }: { alerte: AlerteContrat | null }) {
  if (!alerte) return null;
  return (
    <Badge
      className={cn(
        "border-transparent",
        alerte === "a_decider" ? "bg-amber-400 text-black" : "bg-red-600 text-white dark:bg-red-500",
      )}
    >
      {LIBELLES[alerte]}
    </Badge>
  );
}
