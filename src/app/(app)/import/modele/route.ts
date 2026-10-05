import { exigerUtilisateur } from "@/lib/auth";
import { genererModele } from "@/lib/import/fichier";

export async function GET(request: Request) {
  await exigerUtilisateur(["admin", "technicien"]);
  const type = new URL(request.url).searchParams.get("type") === "equipements" ? "equipements" : "controles";
  const contenu = await genererModele(type);
  return new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jalon-modele-${type}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
