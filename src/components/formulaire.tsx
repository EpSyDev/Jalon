"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = (formData: FormData) => Promise<{ erreur: string } | undefined | void>;

/**
 * Formulaire branché sur une action serveur. Les saisies sont conservées en cas d'erreur
 * (pas de réinitialisation automatique), le message d'erreur s'affiche sous les champs.
 */
export function Formulaire({
  action,
  children,
  libelle,
  libelleEnCours = "Enregistrement…",
  variante = "default",
  confirmation,
  reinitialiser = false,
  className,
}: {
  action: Action;
  children?: ReactNode;
  libelle: string;
  libelleEnCours?: string;
  variante?: "default" | "outline" | "destructive" | "secondary";
  /** Message de confirmation avant envoi (actions irréversibles). */
  confirmation?: string;
  /** Vider les champs après succès (formulaire d'ajout restant sur la page). */
  reinitialiser?: boolean;
  className?: string;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <form
      className={cn("grid gap-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmation && !window.confirm(confirmation)) return;
        const formulaire = e.currentTarget;
        const donnees = new FormData(formulaire);
        demarrer(async () => {
          const resultat = await action(donnees);
          setErreur(resultat?.erreur ?? null);
          if (!resultat?.erreur && reinitialiser) formulaire.reset();
        });
      }}
    >
      {children}
      {erreur && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {erreur}
        </p>
      )}
      <Button type="submit" variant={variante} disabled={enCours} className="h-12 text-base">
        {enCours ? libelleEnCours : libelle}
      </Button>
    </form>
  );
}
