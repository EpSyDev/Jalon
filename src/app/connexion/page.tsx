import { Button } from "@/components/ui/button";
import { Jalon, Marque } from "@/components/marque";
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
      <p className="surtitre rounded-md border border-dashed p-3">Développement local · compte fictif</p>
      {comptes.map((c) => (
        <form key={c.id} action={connexionLocale}>
          <input type="hidden" name="utilisateurId" value={c.id} />
          <input type="hidden" name="suite" value={suite} />
          <Button type="submit" variant="outline" className="h-14 w-full justify-between bg-card text-base">
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
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panneau d'identité (ordinateur) : l'encre du carnet, le jalon planté. */}
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground md:flex md:flex-col md:justify-between">
        <Marque />
        <div className="relative z-10 grid max-w-sm gap-4">
          <p className="surtitre !text-sidebar-foreground/60">Service technique</p>
          <p className="font-heading text-4xl leading-[1.05] font-bold" style={{ fontStretch: "118%" }}>
            Chaque échéance a son jalon. Aucune ne passe.
          </p>
          <p className="text-sidebar-foreground/70">
            Contrôles, parc, interventions et contrats : tout ce qu&apos;il faut retrouver, au même endroit.
          </p>
        </div>
        <p className="surtitre relative z-10 !text-sidebar-foreground/45">
          Outil d&apos;aide au suivi · ne certifie aucune conformité
        </p>
        <Jalon className="pointer-events-none absolute -right-6 bottom-0 h-[78%] text-sidebar-foreground/30" />
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="grid w-full max-w-sm gap-8">
          <div className="grid gap-3">
            <Marque className="md:hidden" />
            <h1 className="text-3xl">Connexion</h1>
            <p className="text-muted-foreground">Accès réservé à l&apos;équipe du service technique.</p>
          </div>
          {local ? <ComptesLocaux suite={suite} /> : <FormulaireConnexion suite={suite} />}
        </div>
      </section>
    </main>
  );
}
