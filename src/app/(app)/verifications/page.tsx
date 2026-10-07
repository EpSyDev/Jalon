import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { requete } from "@/lib/auth";
import { verifications } from "@/lib/requetes/verifications";

export const metadata = { title: "À vérifier — Jalon" };

/** Trous dans le suivi : rien n'y est en retard, mais tout y trahit un oubli possible. */
export default async function PageVerifications() {
  const categories = await requete((tx) => verifications(tx));
  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-1">
        <Link href="/" className="text-sm text-muted-foreground underline">
          ← Aujourd&apos;hui
        </Link>
        <h1 className="text-2xl font-semibold">À vérifier dans le suivi</h1>
        <p className="text-sm text-muted-foreground">
          Aucune alerte ici : seulement des saisies incomplètes ou incohérentes, qui peuvent cacher un oubli.
        </p>
      </div>
      {categories.length === 0 && (
        <p className="flex items-center gap-3 rounded-lg border bg-card p-6 text-lg">
          <CircleCheck className="size-6 text-emerald-600" aria-hidden />
          Rien à vérifier : le suivi est complet.
        </p>
      )}
      {categories.map((c) => (
        <section key={c.cle} className="grid gap-2">
          <h2 className="flex items-baseline gap-2 text-lg font-semibold">
            {c.titre}
            <span className="text-sm font-normal text-muted-foreground">{c.elements.length}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{c.explication}</p>
          <ul className="grid gap-2">
            {c.elements.map((e) => (
              <li key={e.lien + e.libelle}>
                <Link href={e.lien} className="grid gap-0.5 rounded-lg border bg-card p-3 hover:bg-muted/50">
                  <span className="font-medium">{e.libelle}</span>
                  <span className="text-sm text-muted-foreground">{e.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
