import Link from "next/link";
import { lireEnv } from "@/lib/env";
import { schemaLien } from "@/lib/metier/comptes";
import { CarteConnexion } from "../carte";
import { FormulaireLien } from "../formulaires";

export const metadata = { title: "Lien reçu par mail — Jalon" };

/** Cible des mails d'invitation et de réinitialisation (modèles Supabase : voir README). */
export default async function PageLien({ searchParams }: PageProps<"/connexion/lien">) {
  const params = await searchParams;
  const lien = schemaLien.safeParse({ token_hash: params.token_hash, type: params.type });
  const invitation = lien.success && lien.data.type === "invite";

  return (
    <CarteConnexion
      titre={invitation ? "Bienvenue sur Jalon" : "Nouveau mot de passe"}
      description={
        lien.success
          ? "Cliquez sur « Continuer » pour choisir votre mot de passe. Le lien ne sert qu'une fois."
          : "Ce lien est incomplet. Copiez-le en entier depuis le mail, ou demandez-en un nouveau."
      }
    >
      {lireEnv().AUTH_MODE !== "supabase" ? (
        <p className="text-sm text-muted-foreground">Sans objet en mode local.</p>
      ) : lien.success ? (
        <FormulaireLien tokenHash={lien.data.token_hash} type={lien.data.type} />
      ) : (
        <Link href="/connexion/oubli" className="text-center underline">
          Demander un nouveau lien
        </Link>
      )}
    </CarteConnexion>
  );
}
