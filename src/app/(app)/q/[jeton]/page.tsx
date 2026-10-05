import { notFound, redirect } from "next/navigation";
import { requete } from "@/lib/auth";
import { idParQrToken } from "@/lib/requetes/parc";

/** Cible des QR codes : authentification obligatoire (proxy + layout), puis fiche de l'équipement. */
export default async function PageScanQr({ params }: PageProps<"/q/[jeton]">) {
  const { jeton } = await params;
  if (!/^[0-9a-f]{32}$/.test(jeton)) notFound();
  const id = await requete((tx) => idParQrToken(tx, jeton));
  if (!id) notFound();
  redirect(`/equipements/${id}`);
}
