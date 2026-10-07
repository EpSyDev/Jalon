import { exigerUtilisateur } from "@/lib/auth";
import { lireEnv } from "@/lib/env";
import { CarteConnexion } from "../carte";
import { FormulaireMotDePasse } from "../formulaires";

export const metadata = { title: "Choisir un mot de passe — Jalon" };

/** Après un lien d'invitation ou de réinitialisation, ou depuis le menu. 2FA exigée si le compte l'utilise. */
export default async function PageMotDePasse() {
  const utilisateur = await exigerUtilisateur();
  return (
    <CarteConnexion titre="Choisir un mot de passe" description={`Compte : ${utilisateur.nom}`}>
      {lireEnv().AUTH_MODE === "supabase" ? (
        <FormulaireMotDePasse />
      ) : (
        <p className="text-sm text-muted-foreground">Sans objet en mode local.</p>
      )}
    </CarteConnexion>
  );
}
