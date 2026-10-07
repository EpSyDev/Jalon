import "server-only";
import type { Tx } from "@/lib/db";
import { CLE_DERNIERE_SAUVEGARDE, etatSauvegarde as evaluer, type EtatSauvegarde } from "@/lib/metier/sauvegarde";

/** État de la dernière sauvegarde (valeur écrite par la route d'export et par le script en ligne de commande). */
export async function etatSauvegarde(tx: Tx, aujourdhui: string): Promise<EtatSauvegarde> {
  const [ligne] = await tx<{ valeur: unknown }[]>`
    select valeur from public.parametres where cle = ${CLE_DERNIERE_SAUVEGARDE}`;
  return evaluer(typeof ligne?.valeur === "string" ? ligne.valeur : null, aujourdhui);
}
