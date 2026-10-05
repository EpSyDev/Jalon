import Link from "next/link";
import { z } from "zod";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import { requete } from "@/lib/auth";
import { qrImage, urlPublique } from "@/lib/qr";
import { equipementsAEtiqueter } from "@/lib/requetes/parc";

export const metadata = { title: "Étiquettes QR — Jalon" };

export default async function PageEtiquettes({ searchParams }: PageProps<"/equipements/etiquettes">) {
  const { ids: brut } = await searchParams;
  const ids =
    typeof brut === "string"
      ? brut
          .split(",")
          .filter((id) => z.uuid().safeParse(id).success)
          .slice(0, 500)
      : null;
  const equipements = await requete((tx) => equipementsAEtiqueter(tx, ids?.length ? ids : null));
  const base = await urlPublique();
  const etiquettes = await Promise.all(
    equipements.map(async (e) => ({ ...e, qr: await qrImage(`${base}/q/${e.qr_token}`) })),
  );

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8 print:max-w-none print:p-0">
      <div className="grid gap-2 print:hidden">
        <Link href="/equipements" className="text-sm text-muted-foreground underline">
          ← Parc matériel
        </Link>
        <h1 className="text-2xl font-semibold">Étiquettes QR</h1>
        <p className="text-sm text-muted-foreground">
          {etiquettes.length} étiquette{etiquettes.length > 1 ? "s" : ""}. Le QR mène à la fiche de l&apos;équipement,
          après connexion. Adresse encodée : <code className="break-all">{base}</code>
        </p>
        <BoutonImprimer />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {etiquettes.map((e) => (
          <li
            key={e.id}
            className="grid justify-items-center gap-1 rounded-lg border bg-white p-3 text-center text-black break-inside-avoid"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- QR généré côté serveur en data URI */}
            <img src={e.qr} alt={`QR code ${e.code}`} className="size-32" />
            <span className="text-lg font-bold">{e.code}</span>
            <span className="line-clamp-2 text-xs">{e.libelle}</span>
            {e.localisation && <span className="text-[10px] text-neutral-600">{e.localisation}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
