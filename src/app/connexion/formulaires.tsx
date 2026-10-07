"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  definirMotDePasse,
  demanderReinitialisation,
  ouvrirLien,
  seConnecter,
  validerCode2fa,
  type EtatFormulaire,
} from "./actions";

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
      <Link href="/connexion/oubli" className="text-center text-sm text-muted-foreground underline">
        Mot de passe oublié ?
      </Link>
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

function Succes({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
      {message}
    </p>
  );
}

export function FormulaireLien({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [etat, action, enCours] = useActionState(ouvrirLien, ETAT_INITIAL);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <Erreur message={etat.erreur} />
      <Button type="submit" disabled={enCours} className="h-12 text-base">
        {enCours ? "Vérification…" : "Continuer"}
      </Button>
    </form>
  );
}

export function FormulaireOubli() {
  const [etat, action, enCours] = useActionState(demanderReinitialisation, ETAT_INITIAL);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Adresse mail du compte</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="h-12 text-base" />
      </div>
      <Erreur message={etat.erreur} />
      <Succes message={etat.message} />
      <Button type="submit" disabled={enCours} className="h-12 text-base">
        {enCours ? "Envoi…" : "Recevoir un lien"}
      </Button>
      <Link href="/connexion" className="text-center text-sm text-muted-foreground underline">
        Retour à la connexion
      </Link>
    </form>
  );
}

export function FormulaireMotDePasse() {
  const [etat, action, enCours] = useActionState(definirMotDePasse, ETAT_INITIAL);
  if (etat.message) {
    return (
      <div className="grid gap-4">
        <Succes message={etat.message} />
        <Link href="/" className="text-center text-base font-medium underline">
          Aller à l&apos;accueil
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="motDePasse">Nouveau mot de passe</Label>
        <Input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
          className="h-12 text-base"
          aria-describedby="aide-mot-de-passe"
        />
        <p id="aide-mot-de-passe" className="text-xs text-muted-foreground">
          12 caractères minimum. Une phrase de plusieurs mots est plus sûre et plus facile à retenir.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          className="h-12 text-base"
        />
      </div>
      <Erreur message={etat.erreur} />
      <Button type="submit" disabled={enCours} className="h-12 text-base">
        {enCours ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
