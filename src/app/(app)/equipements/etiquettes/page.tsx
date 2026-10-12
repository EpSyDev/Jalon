import Link from "next/link";
import { z } from "zod";
import { requete } from "@/lib/auth";
import { AUCUN } from "@/lib/metier/parc";
import { urlPublique } from "@/lib/qr";
import { equipementsAEtiqueter, listerCategories, listerUnivers } from "@/lib/requetes/parc";
import { cn } from "@/lib/utils";
import { PlancheEtiquettes } from "./planche";

export const metadata = { title: "Étiquettes QR — Jalon" };

const UUID = z.uuid();

function Puce({ href, actif, libelle }: { href: string; actif: boolean; libelle: string }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted/60",
        actif && "border-foreground bg-foreground text-background hover:bg-foreground",
      )}
    >
      {libelle}
    </Link>
  );
}

export default async function PageEtiquettes({ searchParams }: PageProps<"/equipements/etiquettes">) {
  const params = await searchParams;
  const valeur = (v: unknown) => (typeof v === "string" && (v === AUCUN || UUID.safeParse(v).success) ? v : undefined);
  const ids =
    typeof params.ids === "string"
      ? params.ids
          .split(",")
          .filter((id) => UUID.safeParse(id).success)
          .slice(0, 500)
      : null;
  const univers = ids?.length ? undefined : valeur(params.univers);
  const categorie = ids?.length ? undefined : valeur(params.categorie);

  const { etiquettes, listeUnivers, categories } = await requete(async (tx) => {
    const [etiquettes, listeUnivers, categories] = await Promise.all([
      equipementsAEtiqueter(tx, { ids, univers, categorie }),
      listerUnivers(tx),
      listerCategories(tx),
    ]);
    return { etiquettes, listeUnivers, categories };
  });
  const base = await urlPublique();
  const siennes = categories.filter((c) =>
    univers === AUCUN ? c.univers_id === null : univers ? c.univers_id === univers : false,
  );
  const adresse = (u?: string, c?: string) => {
    const q = new URLSearchParams();
    if (u) q.set("univers", u);
    if (c) q.set("categorie", c);
    return `/equipements/etiquettes${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:p-8 print:max-w-none print:p-0">
      <div className="grid gap-3 print:hidden">
        <Link href="/equipements" className="text-sm text-muted-foreground underline">
          ← Parc
        </Link>
        <h1 className="text-2xl font-semibold">Étiquettes QR</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez le périmètre, décochez ce que vous ne voulez pas, puis imprimez (A4, traits de coupe en
          pointillés). Le QR mène à la fiche de l&apos;équipement, après connexion. Adresse encodée :{" "}
          <code className="break-all">{base}</code>
        </p>
        {ids?.length ? (
          <p className="text-sm">
            {ids.length === 1 ? "Étiquette d'un seul équipement." : `${ids.length} équipements choisis.`}{" "}
            <Link href={adresse()} className="underline">
              Voir tout le parc
            </Link>
          </p>
        ) : (
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
            <nav aria-label="Univers" className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs text-muted-foreground sm:w-auto">Univers</span>
              <Puce href={adresse()} actif={!univers} libelle="Tout le parc" />
              {listeUnivers.map((u) => (
                <Puce key={u.id} href={adresse(u.id)} actif={univers === u.id} libelle={u.libelle} />
              ))}
              <Puce href={adresse(AUCUN)} actif={univers === AUCUN} libelle="Sans univers" />
            </nav>
            {siennes.length > 0 && (
              <nav aria-label="Catégories" className="flex flex-wrap items-center gap-2">
                <span className="w-full text-xs text-muted-foreground sm:w-auto">Catégorie</span>
                <Puce href={adresse(univers)} actif={!categorie} libelle="Toutes" />
                {siennes.map((c) => (
                  <Puce key={c.id} href={adresse(univers, c.id)} actif={categorie === c.id} libelle={c.libelle} />
                ))}
              </nav>
            )}
          </div>
        )}
      </div>

      {etiquettes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground print:hidden">
          Aucun équipement à étiqueter dans ce périmètre.
        </p>
      ) : (
        <PlancheEtiquettes
          // Nouvelle planche (tout coché) à chaque changement de périmètre.
          key={`${univers ?? ""}-${categorie ?? ""}-${ids?.join(",") ?? ""}`}
          base={base}
          etiquettes={etiquettes.map((e) => ({
            id: e.id,
            code: e.code,
            libelle: e.libelle,
            localisation: e.localisation,
            jeton: e.qr_token,
            groupe: [e.univers ?? "Sans univers", e.categorie ?? "Sans catégorie"].join(" · "),
          }))}
        />
      )}
    </div>
  );
}
