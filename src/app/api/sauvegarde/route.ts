import { exigerUtilisateur } from "@/lib/auth";
import { sqlBrut } from "@/lib/db";
import { CLE_DERNIERE_SAUVEGARDE } from "@/lib/metier/sauvegarde";
import { exporterBase } from "@/lib/sauvegarde";

/** Téléchargement d'une sauvegarde complète : administrateurs uniquement (2FA exigée en production). */
export async function GET() {
  const admin = await exigerUtilisateur(["admin"]);
  const sql = sqlBrut();
  const sauvegarde = await sql.begin((tx) =>
    exporterBase({ requete: (texte, params) => tx.unsafe(texte, (params ?? []) as never[]) as never }),
  );
  // Mémorise l'export pour l'alerte « sauvegarde trop ancienne » (écriture réservée au propriétaire de la base).
  await sql`
    insert into public.parametres (cle, valeur, description)
    values (${CLE_DERNIERE_SAUVEGARDE}, to_jsonb(now()::text), 'Instant de la dernière sauvegarde téléchargée.')
    on conflict (cle) do update set valeur = excluded.valeur`;
  console.info(`Sauvegarde téléchargée par ${admin.id}`);
  const nom = `jalon-${sauvegarde.cree_le.slice(0, 10)}.json`;
  return new Response(JSON.stringify(sauvegarde), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
