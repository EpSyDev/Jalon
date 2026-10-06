"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { LIBELLES_ROLE, type Role } from "@/lib/roles";
import { estActif, modulesVisibles } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { RappelDonneesPatient } from "@/components/rappel-donnees-patient";
import { BoutonDeconnexion } from "@/components/bouton-deconnexion";
import { Marque } from "@/components/marque";
import { BoutonRecherche, FenetreRecherche } from "@/components/recherche";

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");

/** Lien de la barre basse : indicateur orange au-dessus de l'onglet actif. */
function OngletMobile({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors",
        actif && "font-semibold text-primary",
      )}
    >
      <span
        className={cn(
          "absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-jalon transition-opacity",
          actif ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
      {children}
    </Link>
  );
}

export function Navigation({ role, nom }: { role: Role; nom: string }) {
  const chemin = usePathname();
  const modules = modulesVisibles(role);

  return (
    <>
      {/* Bureau : barre latérale à l'encre (la « reliure » du carnet) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-sidebar p-3 text-sidebar-foreground md:flex print:hidden">
        <Link href="/" className="px-3 pt-3 pb-5" aria-label="Jalon — Aujourd'hui">
          <Marque />
        </Link>
        <div className="mb-4">
          <BoutonRecherche variante="barre" />
        </div>
        <nav className="grid gap-0.5 overflow-y-auto" aria-label="Navigation principale">
          {modules.map(({ href, libelle, icone: Icone }) => {
            const actif = estActif(href, chemin);
            return (
              <Link
                key={href}
                href={href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  actif && "bg-sidebar-accent font-semibold text-sidebar-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-jalon transition-opacity",
                    actif ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <Icone className="size-4" aria-hidden />
                {libelle}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-4 px-3 pt-4 pb-2 text-sm">
          <RappelDonneesPatient className="text-sidebar-foreground/55" />
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent font-heading text-sm font-bold">
              {initiales(nom)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{nom}</div>
              <div className="surtitre !text-sidebar-foreground/55">{LIBELLES_ROLE[role]}</div>
            </div>
          </div>
          <BoutonDeconnexion className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground dark:bg-transparent" />
        </div>
      </aside>

      {/* Mobile : en-tête avec recherche */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-md md:hidden print:hidden">
        <Link href="/" aria-label="Jalon — Aujourd'hui">
          <Marque />
        </Link>
        <BoutonRecherche variante="icone" />
      </header>

      <FenetreRecherche />

      {/* Mobile : barre basse, utilisable au pouce */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
        aria-label="Navigation principale"
      >
        {modules
          .filter((m) => m.principal)
          .map(({ href, libelle, icone: Icone }) => (
            <OngletMobile key={href} href={href} actif={estActif(href, chemin)}>
              <Icone className="size-6" aria-hidden />
              {libelle}
            </OngletMobile>
          ))}
        <OngletMobile href="/menu" actif={chemin === "/menu"}>
          <Menu className="size-6" aria-hidden />
          Menu
        </OngletMobile>
      </nav>
    </>
  );
}
