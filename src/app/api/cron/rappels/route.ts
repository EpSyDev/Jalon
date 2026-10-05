import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { lireEnvRappels } from "@/lib/env";
import { executerRappels } from "@/lib/rappels/executer";

function autorise(entete: string | null, secret: string): boolean {
  const recu = Buffer.from(entete ?? "");
  const attendu = Buffer.from(`Bearer ${secret}`);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

/** Appelé chaque jour par Vercel Cron (en-tête « Authorization: Bearer CRON_SECRET »). */
export async function GET(request: Request) {
  if (!autorise(request.headers.get("authorization"), lireEnvRappels().CRON_SECRET)) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }
  try {
    return NextResponse.json(await executerRappels());
  } catch (e) {
    console.error("Cron rappels en échec :", (e as Error).message);
    return NextResponse.json({ erreur: "Échec de l'exécution des rappels." }, { status: 500 });
  }
}
