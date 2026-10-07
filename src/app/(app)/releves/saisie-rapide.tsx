"use client";

import { useState, useTransition } from "react";
import { MESSAGE_RESEAU } from "@/components/formulaire";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enregistrerReleve } from "./actions";

/** Valeur lue sur place, enregistrée d'une main (date du jour). Le résultat reste affiché sous le champ. */
export function SaisieRapide({ pointId, unite, libelle }: { pointId: string; unite: string | null; libelle: string }) {
  const [retour, setRetour] = useState<{ erreur?: string; message?: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <form
      className="grid gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const formulaire = e.currentTarget;
        const donnees = new FormData(formulaire);
        demarrer(async () => {
          try {
            const r = await enregistrerReleve(pointId, donnees);
            if (r && "erreur" in r) return setRetour({ erreur: r.erreur });
            setRetour({ message: r?.message });
            formulaire.reset();
          } catch {
            setRetour({ erreur: MESSAGE_RESEAU });
          }
        });
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          id={`valeur-${pointId}`}
          name="valeur"
          inputMode="decimal"
          required
          autoComplete="off"
          aria-label={`Valeur relevée : ${libelle}`}
          placeholder={unite ? `Valeur (${unite})` : "Valeur"}
          className="h-12 w-full min-w-0 text-base"
        />
        <Button type="submit" disabled={enCours} className="h-12 shrink-0 text-base">
          {enCours ? "…" : "Relever"}
        </Button>
      </div>
      {retour?.erreur && (
        <p role="alert" className="text-sm text-destructive">
          {retour.erreur}
        </p>
      )}
      {retour?.message && (
        <p
          role="status"
          className={
            retour.message.startsWith("Enregistré, mais")
              ? "text-sm font-medium text-destructive"
              : "text-sm text-emerald-700 dark:text-emerald-400"
          }
        >
          {retour.message}
        </p>
      )}
    </form>
  );
}
