"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { LIBELLES_ROLE, type Role } from "@/lib/roles";
import { estActif, modulesVisibles } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { RappelDonneesPatient } from "@/components/rappel-donnees-patient";
import { BoutonDeconnexion } from "@/components/bouton-deconnexion";

export function Navigation({ role, nom }: { role: Role; nom: string }) {
  const chemin = usePathname();
  const modules = modulesVisibles(role);

  return (
    <>
      {/* Bureau : barre latérale */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar p-3 md:flex">
        <div className="px-3 py-4 text-xl font-semibold">Jalon</div>
        <nav className="grid gap-1" aria-label="Navigation principale">
          {modules.map(({ href, libelle, icone: Icone }) => (
            <Link
              key={href}
              href={href}
              aria-current={estActif(href, chemin) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent",
                estActif(href, chemin) && "bg-sidebar-accent font-medium",
              )}
            >
              <Icone className="size-4" aria-hidden />
              {libelle}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 px-3 py-2 text-sm">
          <RappelDonneesPatient />
          <div>
            <div className="font-medium">{nom}</div>
            <div className="text-muted-foreground">{LIBELLES_ROLE[role]}</div>
          </div>
          <BoutonDeconnexion />
        </div>
      </aside>

      {/* Mobile : barre basse, utilisable au pouce */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navigation principale"
      >
        {modules
          .filter((m) => m.principal)
          .map(({ href, libelle, icone: Icone }) => (
            <Link
              key={href}
              href={href}
              aria-current={estActif(href, chemin) ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
                estActif(href, chemin) && "font-medium text-foreground",
              )}
            >
              <Icone className="size-6" aria-hidden />
              {libelle}
            </Link>
          ))}
        <Link
          href="/menu"
          aria-current={chemin === "/menu" ? "page" : undefined}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
            chemin === "/menu" && "font-medium text-foreground",
          )}
        >
          <Menu className="size-6" aria-hidden />
          Menu
        </Link>
      </nav>
    </>
  );
}
