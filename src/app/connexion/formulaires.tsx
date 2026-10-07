"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { seConnecter, validerCode2fa, type EtatFormulaire } from "./actions";

const ETAT_INITIAL: EtatFormulaire = { erreur: null };

function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState(seConnecter, ETAT_INITIAL);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="suite" value={suite} />
      <div className="grid gap-2">
        <Label htmlFor="email">Adresse mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="h-12 text-base" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="motDePasse">Mot de passe</Label>
        <Input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 text-base"
        />
      </div>
      <Erreur message={etat.erreur} />
      <Button type="submit" disabled={enCours} className="h-12 text-base">
        {enCours ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

export function FormulaireCode2fa({ factorId, suite }: { factorId: string; suite: string }) {
  const [etat, action, enCours] = useActionState(validerCode2fa, ETAT_INITIAL);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="suite" value={suite} />
      <div className="grid gap-2">
        <Label htmlFor="code">Code à 6 chiffres</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="h-12 text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <Erreur message={etat.erreur} />
      <Button type="submit" disabled={enCours} className="h-12 text-base">
        {enCours ? "Vérification…" : "Valider"}
      </Button>
    </form>
  );
}
