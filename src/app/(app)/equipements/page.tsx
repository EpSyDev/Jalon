import Link from "next/link";
import { ChevronRight, Download, Layers, MapPin, Plus, QrCode, Search } from "lucide-react";
import { BadgeStatutEquipement } from "@/components/badges";
import { LienBouton } from "@/components/lien-bouton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  AUCUN,
  estRetire,
  LIBELLES_STATUT_EQUIPEMENT,
  STATUTS_EQUIPEMENT,
  STATUTS_INDISPONIBLES,
  STATUTS_RETIRES,
} from "@/lib/metier/parc";
import {
  listerCategories,
  listerEquipements,
  listerUnivers,
  materielIndisponible,
  optionsEquipement,
  PAR_PAGE,
  syntheseParUnivers,
} from "@/lib/requetes/parc";
import { cn } from "@/lib/utils";
import { adresseParc, lireFiltresParc, TOUS, type FiltresAdresse } from "./filtres";
import { ListeEquipements } from "./liste-equipements";
import { ListeNavigante } from "./navigation-parc";

export const metadata = { title: "Parc matériel — Jalon" };

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Choix d'une valeur de filtre, avec son nombre d'équipements. */
function Puce({ href, actif, libelle, n }: { href: string; actif: boolean; libelle: string; n?: number }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted/60",
        actif && "border-foreground bg-foreground text-background hover:bg-foreground",
      )}
    >
      {libelle}
      {n !== undefined && <span className={cn("tabular-nums", !actif && "text-muted-foreground")}>{n}</span>}
    </Link>
  );
}

function Recherche({ filtres, placeholder }: { filtres: Partial<FiltresAdresse>; placeholder: string }) {
  return (
    <form action="/equipements" className="flex gap-2" role="search">
      {(["univers", "categorie", "statut", "localisation"] as const).map(
        (cle) => filtres[cle] && <input key={cle} type="hidden" name={cle} value={filtres[cle]} />,
      )}
      <Input
        name="q"
        defaultValue={filtres.q}
        placeholder={placeholder}
        className="h-12 text-base"
        aria-label="Rechercher un matériel"
      />
      <Button type="submit" className="h-12 shrink-0 px-4">
        <Search className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Rechercher</span>
      </Button>
    </form>
  );
}

function Actions({ peutEcrire, nouveau }: { peutEcrire: boolean; nouveau: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <LienBouton href="/equipements/univers" variante="outline">
        <Layers className="size-4" aria-hidden />
        Univers et catégories
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
        <LienBouton href={nouveau}>
          <Plus className="size-4" aria-hidden />
          Nouvel équipement
        </LienBouton>
      )}
    </div>
  );
}

export default async function PageEquipements({ searchParams }: PageProps<"/equipements">) {
  const params = await searchParams;
  const filtres = lireFiltresParc((cle) => params[cle]);
  const accueil = !filtres.univers && !filtres.q && !filtres.categorie && !filtres.localisation && !filtres.statut;
  return accueil ? <Accueil /> : <Liste filtres={filtres} />;
}

// --- Accueil : choisir un univers ----------------------------------------------------------

async function Accueil() {
  const { univers, synthese, categories, indisponibles, peutEcrire } = await requete(async (tx, u) => {
    const [univers, synthese, categories, indisponibles] = await Promise.all([
      listerUnivers(tx),
      syntheseParUnivers(tx),
      listerCategories(tx),
      materielIndisponible(tx),
    ]);
    return { univers, synthese, categories, indisponibles, peutEcrire: u.role !== "lecture" };
  });
  const chiffres = (id: string | null) =>
    synthese.find((s) => s.univers_id === id) ?? { en_parc: 0, indisponibles: 0, retires: 0, en_retard: 0 };
  const sansUnivers = chiffres(null);
  const total = synthese.reduce((n, s) => n + s.en_parc, 0);
  const aujourdhui = aujourdhuiParis();

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Parc matériel</h1>
        <Actions peutEcrire={peutEcrire} nouveau="/equipements/nouveau" />
      </div>

      <Recherche filtres={{}} placeholder="Code, n° de série, marque, modèle, catégorie, notes…" />

      <section className="grid gap-3" aria-labelledby="titre-univers">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titre-univers" className="text-lg font-semibold">
            Univers
          </h2>
          {total > 0 && (
            <Link href={adresseParc({ univers: TOUS })} className="text-sm underline">
              Tout le parc en liste ({total})
            </Link>
          )}
        </div>
        {univers.length === 0 && sansUnivers.en_parc === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Aucun équipement. Créez vos univers (Univers et catégories), puis vos équipements ou importez votre liste
            (menu Import).
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {univers.map((u) => {
              const c = chiffres(u.id);
              const principales = categories
                .filter((k) => k.univers_id === u.id && k.nb_equipements > 0)
                .sort((a, b) => b.nb_equipements - a.nb_equipements);
              return (
                <li key={u.id}>
                  <Link
                    href={adresseParc({ univers: u.id })}
                    className="group grid h-full gap-2 rounded-lg border bg-card p-4 hover:border-foreground/40 hover:bg-muted/40"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-lg font-semibold">{u.libelle}</span>
                      <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
                    </span>
                    <span className="text-sm">
                      <span className="text-2xl font-semibold tabular-nums">{c.en_parc}</span> matériel
                      {c.en_parc > 1 ? "s" : ""}
                    </span>
                    {(c.indisponibles > 0 || c.en_retard > 0) && (
                      <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        {c.indisponibles > 0 && (
                          <span className="text-amber-800 dark:text-amber-300">
                            {pluriel(c.indisponibles, "indisponible", "indisponibles")}
                          </span>
                        )}
                        {c.en_retard > 0 && (
                          <span className="text-red-700 dark:text-red-400">{c.en_retard} en retard de contrôle</span>
                        )}
                      </span>
                    )}
                    {principales.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {principales
                          .slice(0, 4)
                          .map((k) => k.libelle)
                          .join(" · ")}
                        {principales.length > 4 && ` · +${principales.length - 4}`}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            {sansUnivers.en_parc + sansUnivers.retires > 0 && (
              <li>
                <Link
                  href={adresseParc({ univers: AUCUN })}
                  className="grid h-full gap-2 rounded-lg border border-dashed p-4 hover:bg-muted/40"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-lg font-semibold">Sans univers</span>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="text-sm">
                    <span className="text-2xl font-semibold tabular-nums">{sansUnivers.en_parc}</span> à ranger
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Sélectionnez-les par lot pour leur donner un univers, ou rangez leurs catégories entières.
                  </span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {indisponibles.length > 0 && (
        <section className="grid gap-3" aria-labelledby="titre-indisponibles">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titre-indisponibles" className="text-lg font-semibold">
              Indisponible en ce moment ({indisponibles.length})
            </h2>
            <Link href={adresseParc({ univers: TOUS, statut: "indisponibles" })} className="text-sm underline">
              Voir en liste
            </Link>
          </div>
          <ul className="grid gap-2">
            {indisponibles.map((e) => {
              const depasse = e.statut_retour_prevu !== null && e.statut_retour_prevu < aujourdhui;
              return (
                <li key={e.id}>
                  <Link
                    href={`/equipements/${e.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50"
                  >
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="font-medium">
                        {e.code} — {e.libelle}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <BadgeStatutEquipement statut={e.statut} />
                        {e.prestataire && <span>chez {e.prestataire}</span>}
                        {e.statut_depuis && <span>depuis le {formaterDate(e.statut_depuis)}</span>}
                        {e.statut_retour_prevu && (
                          <span className={cn(depasse && "font-semibold text-red-700 dark:text-red-400")}>
                            retour prévu le {formaterDate(e.statut_retour_prevu)}
                            {depasse && " (dépassé)"}
                          </span>
                        )}
                        {e.univers && <span>· {e.univers}</span>}
                      </span>
                      {e.statut_motif && <span className="truncate text-sm">{e.statut_motif}</span>}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// --- Liste filtrée ------------------------------------------------------------------------------

async function Liste({ filtres }: { filtres: FiltresAdresse }) {
  const { page, ...criteres } = filtres;
  const { equipements, total, facettes, options, peutEcrire } = await requete(async (tx, u) => ({
    ...(await listerEquipements(tx, criteres, page)),
    options: await optionsEquipement(tx),
    peutEcrire: u.role !== "lecture",
  }));
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const vers = (changements: Partial<FiltresAdresse>) => adresseParc({ ...criteres, ...changements, page: undefined });
  const universCourant = options.univers.find((u) => u.id === criteres.univers);
  const dansUnUnivers = Boolean(universCourant) || criteres.univers === AUCUN;
  const titre = universCourant?.libelle ?? (criteres.univers === AUCUN ? "Sans univers" : "Tout le parc");
  const nomCategorie = (id: string) =>
    id === AUCUN ? "Sans catégorie" : (options.categories.find((c) => c.id === id)?.libelle ?? "Catégorie archivée");
  const nomLocalisation = (id: string) =>
    id === AUCUN ? "Non renseignée" : (options.localisations.find((l) => l.id === id)?.libelle ?? "Archivée");
  const enParc = STATUTS_EQUIPEMENT.filter((s) => !estRetire(s)).reduce((n, s) => n + facettes.statuts[s], 0);
  const groupes = (
    [
      ["indisponibles", "Tous les indisponibles", STATUTS_INDISPONIBLES],
      ["retires", "Tous les retirés", STATUTS_RETIRES],
    ] as const
  ).map(([cle, libelle, statuts]) => ({
    cle,
    libelle,
    n: statuts.reduce((n, s) => n + facettes.statuts[s], 0),
    presents: statuts.filter((s) => facettes.statuts[s] > 0).length,
  }));
  const retiresMasques = !criteres.statut ? facettes.statuts.declasse + facettes.statuts.reforme : 0;
  const categoriesPresentes = Object.entries(facettes.categories).sort(([a], [b]) =>
    a === AUCUN ? 1 : b === AUCUN ? -1 : nomCategorie(a).localeCompare(nomCategorie(b), "fr"),
  );
  const localisationsPresentes = Object.entries(facettes.localisations).sort(([a], [b]) =>
    a === AUCUN ? 1 : b === AUCUN ? -1 : nomLocalisation(a).localeCompare(nomLocalisation(b), "fr"),
  );
  // Une rangée de filtres n'apparaît que si elle permet vraiment de trier.
  const voirCategories = dansUnUnivers && categoriesPresentes.length > 0;
  const voirStatuts =
    Boolean(criteres.statut) || STATUTS_EQUIPEMENT.some((s) => s !== "en_service" && facettes.statuts[s] > 0);
  const voirLocalisations = localisationsPresentes.length > 1 || Boolean(criteres.localisation);
  const filtreActif = Boolean(criteres.q || criteres.categorie || criteres.localisation || criteres.statut);
  const nouveau = `/equipements/nouveau${
    universCourant
      ? `?univers=${universCourant.id}${criteres.categorie && criteres.categorie !== AUCUN ? `&categorie=${criteres.categorie}` : ""}`
      : ""
  }`;
  // Sélection groupée : catégories de l'univers affiché seulement (transversales pour « Sans univers »).
  const categoriesSelection = universCourant
    ? options.categories.filter((c) => c.univers_id === universCourant.id)
    : criteres.univers === AUCUN
      ? options.categories.filter((c) => c.univers_id === null)
      : [];

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="grid gap-2">
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/equipements" className="underline">
            Parc
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span>{titre}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{titre}</h1>
          <Actions peutEcrire={peutEcrire} nouveau={nouveau} />
        </div>
      </div>

      <Recherche
        filtres={criteres}
        placeholder={
          universCourant ? `Rechercher dans ${universCourant.libelle}…` : "Code, n° de série, marque, modèle…"
        }
      />

      {(voirCategories || voirStatuts || voirLocalisations) && (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
          {voirCategories && (
            <nav aria-label="Catégories" className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs text-muted-foreground sm:w-auto">Catégorie</span>
              <Puce
                href={vers({ categorie: undefined })}
                actif={!criteres.categorie}
                libelle="Toutes"
                n={Object.values(facettes.categories).reduce((a, b) => a + b, 0)}
              />
              {categoriesPresentes.map(([id, n]) => (
                <Puce
                  key={id}
                  href={vers({ categorie: id })}
                  actif={criteres.categorie === id}
                  libelle={nomCategorie(id)}
                  n={n}
                />
              ))}
            </nav>
          )}
          {voirStatuts && (
            <nav aria-label="Statut" className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs text-muted-foreground sm:w-auto">Statut</span>
              <Puce href={vers({ statut: undefined })} actif={!criteres.statut} libelle="En parc" n={enParc} />
              {groupes
                .filter((g) => g.presents > 1 || criteres.statut === g.cle)
                .map((g) => (
                  <Puce
                    key={g.cle}
                    href={vers({ statut: g.cle })}
                    actif={criteres.statut === g.cle}
                    libelle={g.libelle}
                    n={g.n}
                  />
                ))}
              {STATUTS_EQUIPEMENT.filter((s) => facettes.statuts[s] > 0 || criteres.statut === s).map((s) => (
                <Puce
                  key={s}
                  href={vers({ statut: s })}
                  actif={criteres.statut === s}
                  libelle={LIBELLES_STATUT_EQUIPEMENT[s]}
                  n={facettes.statuts[s]}
                />
              ))}
            </nav>
          )}
          {voirLocalisations ? (
            <ListeNavigante
              libelle="Localisation"
              valeur={criteres.localisation ?? ""}
              options={[
                { valeur: "", libelle: "Toutes les localisations", adresse: vers({ localisation: undefined }) },
                ...localisationsPresentes.map(([id, n]) => ({
                  valeur: id,
                  libelle: `${nomLocalisation(id)} (${n})`,
                  adresse: vers({ localisation: id }),
                })),
              ]}
            />
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {pluriel(total, "équipement", "équipements")}
          {pages > 1 && ` · page ${page} sur ${pages}`}
          {retiresMasques > 0 && (
            <>
              {" · "}
              <Link href={vers({ statut: "retires" })} className="underline">
                {pluriel(retiresMasques, "retiré du parc masqué", "retirés du parc masqués")}
              </Link>
            </>
          )}
          {filtreActif && (
            <>
              {" · "}
              <Link href={adresseParc({ univers: criteres.univers })} className="underline">
                Effacer les filtres
              </Link>
            </>
          )}
        </p>
        {total > 0 && (
          <a
            href={`/equipements/export${vers({}).slice("/equipements".length)}`}
            className="inline-flex items-center gap-1 underline"
          >
            <Download className="size-4" aria-hidden />
            Exporter (Excel)
          </a>
        )}
      </div>

      {equipements.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {criteres.q ? `Aucun matériel ne correspond à « ${criteres.q} ».` : "Aucun matériel avec ces filtres."}
        </p>
      ) : (
        <ListeEquipements
          equipements={equipements}
          univers={options.univers}
          categories={categoriesSelection}
          localisations={options.localisations}
          peutEcrire={peutEcrire}
          afficherUnivers={!universCourant}
          aujourdhui={aujourdhuiParis()}
        />
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Pages">
          {page > 1 ? (
            <LienBouton href={adresseParc({ ...criteres, page: page - 1 })} variante="outline" className="h-11">
              ← Précédents
            </LienBouton>
          ) : (
            <span />
          )}
          {page < pages && (
            <LienBouton href={adresseParc({ ...criteres, page: page + 1 })} variante="outline" className="h-11">
              Suivants →
            </LienBouton>
          )}
        </nav>
      )}
    </div>
  );
}
