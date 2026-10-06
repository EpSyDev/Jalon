import Link from "next/link";
import { ChevronRight, Layers, MapPin, Plus, QrCode } from "lucide-react";
import { BadgeStatut } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { requete } from "@/lib/auth";
import { listerEquipements, listerUnivers, optionsEquipement } from "@/lib/requetes/parc";
import { cn } from "@/lib/utils";
import { LIBELLES_STATUT_EQUIPEMENT } from "./champs-equipement";

export const metadata = { title: "Parc matériel — Jalon" };

export default async function PageEquipements({ searchParams }: PageProps<"/equipements">) {
  const params = await searchParams;
  const texte = (v: unknown) => (typeof v === "string" && v.length <= 100 ? v : undefined);
  const statut = texte(params.statut);
  const famille = texte(params.famille);
  const univers = texte(params.univers);
  const filtres = {
    q: texte(params.q),
    statut: statut && statut in LIBELLES_STATUT_EQUIPEMENT ? statut : undefined,
    famille: famille && /^[0-9a-f-]{36}$/.test(famille) ? famille : undefined,
    univers: univers === "aucun" || (univers && /^[0-9a-f-]{36}$/.test(univers)) ? univers : undefined,
  };

  const { equipements, familles, listeUnivers, peutEcrire } = await requete(async (tx, u) => ({
    equipements: await listerEquipements(tx, filtres),
    familles: (await optionsEquipement(tx)).familles,
    listeUnivers: await listerUnivers(tx),
    peutEcrire: u.role !== "lecture",
  }));

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

      <p className="text-sm text-muted-foreground">
        {equipements.length} équipement{equipements.length > 1 ? "s" : ""}
      </p>

      {equipements.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Aucun équipement. Créez-en un ou importez votre liste (menu Import).
        </p>
      ) : (
        <ul className="grid gap-2">
          {equipements.map((e) => (
            <li key={e.id}>
              <Link
                href={`/equipements/${e.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="font-medium">
                    {e.code} — {e.libelle}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {[e.univers, e.localisation, e.famille].filter(Boolean).join(" · ") || "Sans localisation"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.statut !== "en_service" && (
                      <Badge variant="outline">{LIBELLES_STATUT_EQUIPEMENT[e.statut]}</Badge>
                    )}
                    {e.synthese && <BadgeStatut statut={e.synthese} />}
                    {e.statuts_plans.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {e.statuts_plans.length} contrôle{e.statuts_plans.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
