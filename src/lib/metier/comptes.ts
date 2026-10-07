// Comptes : lien reçu par mail (invitation, réinitialisation) et choix du mot de passe.

import { z } from "zod";

/** Types de lien acceptés : invitation par un admin, ou mot de passe oublié. Rien d'autre. */
export const TYPES_LIEN = ["invite", "recovery"] as const;

export const schemaLien = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{8,200}$/),
  type: z.enum(TYPES_LIEN),
});

// 12 caractères minimum (réglage Supabase du projet) ; 72 maximum (limite de bcrypt, au-delà tout est ignoré).
export const schemaMotDePasse = z
  .object({
    motDePasse: z.string().min(12, "12 caractères minimum").max(72, "72 caractères maximum"),
    confirmation: z.string(),
  })
  .refine((m) => m.motDePasse === m.confirmation, { message: "les deux saisies diffèrent", path: ["confirmation"] });

/** Message lisible pour une erreur Supabase lors du changement de mot de passe. */
export function messageMotDePasse(code: string | undefined): string {
  switch (code) {
    case "weak_password":
      return "Mot de passe trop faible : allongez-le ou évitez les mots de passe courants.";
    case "same_password":
      return "Choisissez un mot de passe différent de l'actuel.";
    case "insufficient_aal":
      return "Validez d'abord la double authentification, puis recommencez.";
    case "session_not_found":
    case "session_expired":
      return "Session expirée : rouvrez le lien reçu par mail ou reconnectez-vous.";
    default:
      return "Changement impossible pour le moment. Réessayez.";
  }
}
