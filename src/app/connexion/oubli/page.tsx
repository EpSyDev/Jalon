import Link from "next/link";
import { lireEnv } from "@/lib/env";
import { CarteConnexion } from "../carte";
import { FormulaireOubli } from "../formulaires";

export const metadata = { title: "Mot de passe oublié — Jalon" };

export default function PageOubli() {
  return (
    <CarteConnexion
      titre="Mot de passe oublié"
      description="Indiquez l'adresse mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe."
    >
      {lireEnv().AUTH_MODE === "supabase" ? (
        <FormulaireOubli />
      ) : (
        <Link href="/connexion" className="text-sm underline">
          Sans objet en mode local : retour à la connexion
        </Link>
      )}
    </CarteConnexion>
  );
}
