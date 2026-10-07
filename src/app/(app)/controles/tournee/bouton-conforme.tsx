"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { MESSAGE_RESEAU } from "@/components/formulaire";
import { Button } from "@/components/ui/button";
import { controleConformeAujourdhui } from "../actions";

/** « Conforme » en deux touches : la première arme le bouton (4 s), la seconde enregistre. Évite le faux contact. */
export function BoutonConforme({ planId }: { planId: string }) {
  const [arme, setArme] = useState(false);
  const [etat, setEtat] = useState<{ erreur?: string; fait?: boolean }>({});
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (!arme) return;
    const minuterie = setTimeout(() => setArme(false), 4000);
    return () => clearTimeout(minuterie);
  }, [arme]);

  if (etat.fait) {
    return (
      <span
        role="status"
        className="flex h-12 items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        <Check className="size-4" aria-hidden />
        Enregistré
      </span>
    );
  }
  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        variant={arme ? "default" : "outline"}
        className="h-12 min-w-32 text-base"
        disabled={enCours}
        onClick={() => {
          if (!arme) return setArme(true);
          demarrer(async () => {
            try {
              const r = await controleConformeAujourdhui(planId);
              setEtat(r && "erreur" in r ? { erreur: r.erreur } : { fait: true });
            } catch {
              setEtat({ erreur: MESSAGE_RESEAU });
            }
            setArme(false);
          });
        }}
      >
        {enCours ? "…" : arme ? "Confirmer" : "Conforme"}
      </Button>
      {etat.erreur && (
        <span role="alert" className="text-xs text-destructive">
          {etat.erreur}
        </span>
      )}
    </div>
  );
}
