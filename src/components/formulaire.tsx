"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MESSAGE_RESEAU = "Envoi impossible : vérifiez le réseau. Votre saisie est conservée, réessayez.";

type Action = (formData: FormData) => Promise<{ erreur: string } | { message: string } | undefined | void>;

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
  const [succes, setSucces] = useState<string | null>(null);
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
          let resultat: Awaited<ReturnType<Action>>;
          try {
            resultat = await action(donnees);
          } catch (e) {
            // Redirection après succès : laissée à Next.js. Sinon réseau coupé : la saisie reste à l'écran.
            unstable_rethrow(e);
            setSucces(null);
            setErreur(MESSAGE_RESEAU);
            return;
          }
          const echec = resultat && "erreur" in resultat ? resultat.erreur : null;
          setErreur(echec);
          setSucces(resultat && "message" in resultat ? resultat.message : null);
          if (!echec && reinitialiser) formulaire.reset();
        });
      }}
    >
      {children}
      {erreur && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {erreur}
        </p>
      )}
      {succes && (
        <p role="status" className="rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {succes}
        </p>
      )}
      <Button type="submit" variant={variante} disabled={enCours} className="h-12 text-base">
        {enCours ? libelleEnCours : libelle}
      </Button>
    </form>
  );
}
