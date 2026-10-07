import Link from "next/link";
import { Download, Layers, MapPin, Plus, QrCode } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { requete } from "@/lib/auth";
import { listerEquipements, listerUnivers, optionsEquipement, PAR_PAGE } from "@/lib/requetes/parc";
import { cn } from "@/lib/utils";
import { LIBELLES_STATUT_EQUIPEMENT } from "./champs-equipement";
import { ListeEquipements } from "./liste-equipements";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const metadata = { title: "Parc matériel — Jalon" };

export default async function PageEquipements({ searchParams }: PageProps<"/equipements">) {
  const params = await searchParams;
  const texte = (v: unknown) => (typeof v === "string" && v.length <= 100 ? v : undefined);
  const statut = texte(params.statut);
  const famille = texte(params.famille);
  const univers = texte(params.univers);
  const localisation = texte(params.localisation);
  const filtres = {
    q: texte(params.q),
    statut: statut && statut in LIBELLES_STATUT_EQUIPEMENT ? statut : undefined,
    famille: famille && UUID.test(famille) ? famille : undefined,
    univers: univers === "aucun" || (univers && UUID.test(univers)) ? univers : undefined,
    localisation: localisation && UUID.test(localisation) ? localisation : undefined,
  };
  const page = Math.min(Math.max(Number.parseInt(texte(params.page) ?? "1", 10) || 1, 1), 1000);

  const { equipements, total, options, listeUnivers, peutEcrire } = await requete(async (tx, u) => ({
    ...(await listerEquipements(tx, filtres, page)),
    options: await optionsEquipement(tx),
    listeUnivers: await listerUnivers(tx),
    peutEcrire: u.role !== "lecture",
  }));
  const familles = options.familles;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  /** Adresse de la même liste (filtres conservés) à une autre page. */
  const versPage = (n: number) => {
    const q = new URLSearchParams(Object.entries(filtres).filter((e): e is [string, string] => Boolean(e[1])));
    if (n > 1) q.set("page", String(n));
    return `/equipements${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Parc matériel</h1>
        <div className="flex flex-wrap gap-2">
          <LienBouton href="/equipements/univers" variante="outline">
            <Layers className="size-4" aria-hidden />
            Univers
          </LienBouton>
          <LienBouton href="/equipements/localisations" variante="outline">
            <MapPin className="size-4" aria-hidden />
            Localisations
          </LienBouton>
          <LienBouton href="/equipements/etiquettes" variante="outline">
            <QrCode className="size-4" aria-hidden />
            Étiquettes QR
          </LienBouton>
          {peutEcrire && (
            <LienBouton href="/equipements/nouveau">
              <Plus className="size-4" aria-hidden />
              Nouvel équipement
            </LienBouton>
          )}
        </div>
      </div>

      {listeUnivers.length > 0 && (
        <nav className="flex flex-wrap gap-2" aria-label="Univers">
          {[
            { cle: undefined, libelle: "Tous les univers" },
            ...listeUnivers.map((u) => ({
              cle: u.id as string | undefined,
              libelle: `${u.libelle} (${u.nb_equipements})`,
            })),
            { cle: "aucun", libelle: "Sans univers" },
          ].map((u) => (
            <Link
              key={u.cle ?? "tous"}
              href={u.cle ? `/equipements?univers=${u.cle}` : "/equipements"}
              className={cn(
                "rounded-full border bg-card px-3 py-1.5 text-sm",
                filtres.univers === u.cle && "border-foreground bg-foreground text-background",
              )}
            >
              {u.libelle}
            </Link>
          ))}
        </nav>
      )}

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        {filtres.univers && <input type="hidden" name="univers" value={filtres.univers} />}
        {filtres.localisation && <input type="hidden" name="localisation" value={filtres.localisation} />}
        <Input
          name="q"
          defaultValue={filtres.q}
          placeholder="Code, libellé, localisation…"
          className="h-11 text-base"
          aria-label="Filtrer"
        />
        <NativeSelect
          name="statut"
          defaultValue={filtres.statut ?? ""}
          aria-label="Statut"
          className="w-full [&_select]:h-11"
        >
          <NativeSelectOption value="">Tous statuts</NativeSelectOption>
          {Object.entries(LIBELLES_STATUT_EQUIPEMENT).map(([v, l]) => (
            <NativeSelectOption key={v} value={v}>
              {l}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="famille"
          defaultValue={filtres.famille ?? ""}
          aria-label="Famille"
          className="w-full [&_select]:h-11"
        >
          <NativeSelectOption value="">Toutes familles</NativeSelectOption>
          {familles.map((f) => (
            <NativeSelectOption key={f.id} value={f.id}>
              {f.libelle}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary" className="h-11">
          Filtrer
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {total} équipement{total > 1 ? "s" : ""}
          {pages > 1 && ` · page ${page} sur ${pages}`}
        </p>
        {total > 0 && (
          <a
            href={`/equipements/export${versPage(1).slice("/equipements".length)}`}
            className="inline-flex items-center gap-1 underline"
          >
            <Download className="size-4" aria-hidden />
            Exporter (Excel)
          </a>
        )}
      </div>

      {equipements.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {total === 0 && page === 1
            ? "Aucun équipement. Créez-en un ou importez votre liste (menu Import)."
            : "Aucun équipement sur cette page."}
        </p>
      ) : (
        <ListeEquipements
          equipements={equipements}
          univers={options.univers}
          localisations={options.localisations}
          peutEcrire={peutEcrire}
        />
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Pages">
          {page > 1 ? (
            <LienBouton href={versPage(page - 1)} variante="outline" className="h-11">
              ← Précédents
            </LienBouton>
          ) : (
            <span />
          )}
          {page < pages && (
            <LienBouton href={versPage(page + 1)} variante="outline" className="h-11">
              Suivants →
            </LienBouton>
          )}
        </nav>
      )}
    </div>
  );
}
