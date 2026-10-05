import { NextResponse } from "next/server";
import { requete } from "@/lib/auth";

export type ResultatRecherche = { type: string; id: string; titre: string; sous_titre: string | null; lien: string };

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json([]);
  const resultats = await requete(
    (tx) => tx<ResultatRecherche[]>`select type, id, titre, sous_titre, lien from public.rechercher(${q}, 20)`,
  );
  return NextResponse.json(resultats, { headers: { "Cache-Control": "private, no-store" } });
}
