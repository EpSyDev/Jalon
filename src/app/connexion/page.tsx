import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sqlBrut } from "@/lib/db";
import { lireEnv } from "@/lib/env";
import { LIBELLES_ROLE, type Role } from "@/lib/roles";
import { connexionLocale } from "./actions";
import { FormulaireConnexion } from "./formulaires";

export const metadata = { title: "Connexion — Jalon" };

async function ComptesLocaux() {
  const comptes = await sqlBrut()<{ id: string; nom: string; role: Role }[]>`
    select id, nom, role from public.profils where archive_le is null order by role, nom`;
  return (
    <div className="grid gap-3">
      <p className="rounded-md bg-muted p-3 text-sm">Mode développement local : choisissez un compte fictif.</p>
      {comptes.map((c) => (
        <form key={c.id} action={connexionLocale}>
          <input type="hidden" name="utilisateurId" value={c.id} />
          <Button type="submit" variant="outline" className="h-14 w-full justify-between text-base">
            {c.nom}
            <span className="text-sm text-muted-foreground">{LIBELLES_ROLE[c.role]}</span>
          </Button>
        </form>
      ))}
    </div>
  );
}

export default function PageConnexion() {
  const local = lireEnv().AUTH_MODE === "local";
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Jalon</CardTitle>
          <CardDescription>Service technique — accès réservé à l&apos;équipe.</CardDescription>
        </CardHeader>
        <CardContent>{local ? <ComptesLocaux /> : <FormulaireConnexion />}</CardContent>
      </Card>
    </main>
  );
}
