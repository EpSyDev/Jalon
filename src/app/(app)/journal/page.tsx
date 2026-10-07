import { ListeJournal } from "@/components/journal";
import { LienBouton } from "@/components/lien-bouton";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requete } from "@/lib/auth";
import { LIBELLES_TABLE } from "@/lib/metier/journal";
import { ENTREES_PAR_PAGE, lireJournal } from "@/lib/requetes/journal";

export const metadata = { title: "Journal des modifications — Jalon" };

/** Journal d'audit (écrit par la base elle-même, non modifiable) : administrateurs uniquement. */
export default async function PageJournal({ searchParams }: PageProps<"/journal">) {
  const params = await searchParams;
  const table = typeof params.table === "string" && params.table in LIBELLES_TABLE ? params.table : undefined;
  const page = Math.min(Math.max(Number.parseInt(String(params.page ?? "1"), 10) || 1, 1), 10_000);
  const { entrees, noms, total } = await requete((tx) => lireJournal(tx, { table, page }), ["admin"]);
  const pages = Math.max(1, Math.ceil(total / ENTREES_PAR_PAGE));
  const versPage = (n: number) => {
    const q = new URLSearchParams();
    if (table) q.set("table", table);
    if (n > 1) q.set("page", String(n));
    return `/journal${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4 md:p-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Journal des modifications</h1>
        <p className="text-sm text-muted-foreground">
          Chaque création, modification et archivage, enregistré par la base elle-même : personne ne peut le modifier.
          Les fiches (équipement, plan, contrat) montrent aussi leur propre historique.
        </p>
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto]" role="search">
        <NativeSelect
          name="table"
          defaultValue={table ?? ""}
          aria-label="Type d'élément"
          className="w-full [&_select]:h-11"
        >
          <NativeSelectOption value="">Tous les éléments</NativeSelectOption>
          {Object.entries(LIBELLES_TABLE).map(([valeur, libelle]) => (
            <NativeSelectOption key={valeur} value={valeur}>
              {libelle}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary" className="h-11">
          Filtrer
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {total} entrée{total > 1 ? "s" : ""}
        {pages > 1 && ` · page ${page} sur ${pages}`}
      </p>

      {entrees.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucune entrée.</p>
      ) : (
        <ListeJournal entrees={entrees} noms={noms} />
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Pages">
          {page > 1 ? (
            <LienBouton href={versPage(page - 1)} variante="outline" className="h-11">
              ← Plus récentes
            </LienBouton>
          ) : (
            <span />
          )}
          {page < pages && (
            <LienBouton href={versPage(page + 1)} variante="outline" className="h-11">
              Plus anciennes →
            </LienBouton>
          )}
        </nav>
      )}
    </div>
  );
}
