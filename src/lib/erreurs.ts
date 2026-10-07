// Traduction des erreurs Postgres en messages lisibles. Aucun détail technique exposé.

type ErreurPostgres = { code?: string; message?: string };

// Messages levés par nos propres triggers (déjà en français) : affichés tels quels.
const MESSAGES_METIER = [
  "La date de réalisation ne peut pas être dans le futur.",
  "Seul un administrateur peut archiver ou désarchiver.",
];

export function messageErreurBase(e: unknown): string {
  const { code, message = "" } = (e ?? {}) as ErreurPostgres;
  const metier = MESSAGES_METIER.find((m) => message.includes(m));
  if (metier) return metier;
  if (message.startsWith("Stock insuffisant")) return message;
  // Trigger refuser_date_future : « La date (levée) ne peut pas être dans le futur. »
  if (/^La date \([^)]{1,40}\) ne peut pas être dans le futur\.$/.test(message)) return message;
  switch (code) {
    case "42501":
      return "Action non autorisée pour votre rôle.";
    case "23505":
      return "Cet élément existe déjà.";
    case "23514":
      return "Valeur incohérente : vérifiez les dates et les nombres saisis.";
    case "23503":
      return "Élément lié introuvable : rechargez la page.";
    default:
      console.error("Erreur base inattendue", code);
      return "Enregistrement impossible. Réessayez.";
  }
}
