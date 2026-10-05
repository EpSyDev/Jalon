import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sqlBrut } from "@/lib/db";
import { lireEnv } from "@/lib/env";
import { LIBELLES_ROLE, type Role } from "@/lib/roles";
import { cheminSur } from "@/lib/metier/parc";
import { connexionLocale } from "./actions";
import { FormulaireConnexion } from "./formulaires";

export const metadata = { title: "Connexion — Jalon" };

async function ComptesLocaux({ suite }: { suite: string }) {
  let comptes: { id: string; nom: string; role: Role }[];
  try {
    comptes = await sqlBrut()<{ id: string; nom: string; role: Role }[]>`
      select id, nom, role from public.profils where archive_le is null order by role, nom`;
  } catch (e) {
    if ((e as { code?: string }).code !== "ECONNREFUSED") throw e;
    return (
      <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        Base locale non démarrée. Lancez <code>npm run dev</code> (base + application) ou <code>npm run db</code> dans
        un autre terminal, puis rechargez la page.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="rounded-md bg-muted p-3 text-sm">Mode développement local : choisissez un compte fictif.</p>
      {comptes.map((c) => (
        <form key={c.id} action={connexionLocale}>
          <input type="hidden" name="utilisateurId" value={c.id} />
          <input type="hidden" name="suite" value={suite} />
          <Button type="submit" variant="outline" className="h-14 w-full justify-between text-base">
            {c.nom}
            <span className="text-sm text-muted-foreground">{LIBELLES_ROLE[c.role]}</span>
          </Button>
        </form>
      ))}
    </div>
  );
}

export default async function PageConnexion({ searchParams }: PageProps<"/connexion">) {
  const suite = cheminSur((await searchParams).suite);
  const local = lireEnv().AUTH_MODE === "local";
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Jalon</CardTitle>
          <CardDescription>Service technique — accès réservé à l&apos;équipe.</CardDescription>
        </CardHeader>
        <CardContent>{local ? <ComptesLocaux suite={suite} /> : <FormulaireConnexion suite={suite} />}</CardContent>
      </Card>
    </main>
  );
}
