import { exigerUtilisateur } from "@/lib/auth";
import { sqlBrut } from "@/lib/db";
import { exporterBase } from "@/lib/sauvegarde";

/** Téléchargement d'une sauvegarde complète : administrateurs uniquement (2FA exigée en production). */
export async function GET() {
  const admin = await exigerUtilisateur(["admin"]);
  const sql = sqlBrut();
  const sauvegarde = await sql.begin((tx) =>
    exporterBase({ requete: (texte, params) => tx.unsafe(texte, (params ?? []) as never[]) as never }),
  );
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
