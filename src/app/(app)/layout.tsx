import { Navigation } from "@/components/navigation";
import { exigerUtilisateur } from "@/lib/auth";

export default async function LayoutApplication({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerUtilisateur();
  return (
    <>
      <Navigation role={utilisateur.role} nom={utilisateur.nom} />
      <main className="pb-24 md:pb-0 md:pl-60 print:p-0">{children}</main>
    </>
  );
}
