import Link from "next/link";
import { BoutonDeconnexion } from "@/components/bouton-deconnexion";
import { RappelDonneesPatient } from "@/components/rappel-donnees-patient";
import { exigerUtilisateur } from "@/lib/auth";
import { lireEnv } from "@/lib/env";
import { modulesVisibles } from "@/lib/navigation";
import { LIBELLES_ROLE } from "@/lib/roles";

export const metadata = { title: "Menu — Jalon" };

export default async function PageMenu() {
  const utilisateur = await exigerUtilisateur();
  return (
    <div className="grid gap-6 p-4">
      <div>
        <div className="text-lg font-semibold">{utilisateur.nom}</div>
        <div className="text-sm text-muted-foreground">{LIBELLES_ROLE[utilisateur.role]}</div>
      </div>
      <nav className="grid grid-cols-2 gap-3" aria-label="Tous les modules">
        {modulesVisibles(utilisateur.role).map(({ href, libelle, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border bg-card text-sm"
          >
            <Icone className="size-6" aria-hidden />
            {libelle}
          </Link>
        ))}
      </nav>
      {lireEnv().AUTH_MODE === "supabase" && (
        <Link href="/connexion/mot-de-passe" className="text-sm underline">
          Changer mon mot de passe
        </Link>
      )}
      <RappelDonneesPatient />
      <BoutonDeconnexion />
    </div>
  );
}
