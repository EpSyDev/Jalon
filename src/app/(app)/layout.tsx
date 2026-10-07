import { BandeauHorsLigne } from "@/components/bandeau-hors-ligne";
import { Navigation } from "@/components/navigation";
import { exigerUtilisateur } from "@/lib/auth";

export default async function LayoutApplication({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerUtilisateur();
  return (
    <>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-card px-4 py-3 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <BandeauHorsLigne />
      <Navigation role={utilisateur.role} nom={utilisateur.nom} />
      <main id="contenu" tabIndex={-1} className="pb-24 outline-none md:pb-0 md:pl-60 print:p-0">
        {children}
      </main>
    </>
  );
}
