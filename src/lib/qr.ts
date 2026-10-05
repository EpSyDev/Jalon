import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { z } from "zod";

/** Adresse publique de l'application : APP_URL si défini, sinon l'hôte de la requête (réseau local). */
export async function urlPublique(): Promise<string> {
  const appUrl = z.url().safeParse(process.env.APP_URL);
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
  // En local, l'hôte réel permet de scanner depuis un téléphone du même réseau (192.168.x.x).
  if (process.env.NODE_ENV !== "production" && hote) {
    return `${entetes.get("x-forwarded-proto") ?? "http"}://${hote}`;
  }
  if (appUrl.success) return appUrl.data.replace(/\/$/, "");
  return `https://${hote}`;
}

/** QR code (image SVG en data URI) pointant vers la fiche via le jeton, jamais l'identifiant interne. */
export async function qrImage(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
