import { CarteConnexion } from "../carte";
import { exigerPremierFacteur } from "@/lib/auth";
import { cheminSur } from "@/lib/metier/parc";
import { creerClientSupabase } from "@/lib/supabase/serveur";
import { seDeconnecter } from "../actions";
import { FormulaireCode2fa } from "../formulaires";

export const metadata = { title: "Double authentification — Jalon" };

export default async function PageDoubleAuthentification({ searchParams }: PageProps<"/connexion/2fa">) {
  const suite = cheminSur((await searchParams).suite);
  await exigerPremierFacteur();
  const supabase = await creerClientSupabase();
  const { data: facteurs } = await supabase.auth.mfa.listFactors();
  const verifie = facteurs?.totp[0];

  let enrolement: { factorId: string; qrCode: string; secret: string } | null = null;
  if (!verifie) {
    // Nettoie les enrôlements abandonnés avant d'en créer un nouveau.
    for (const f of facteurs?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Jalon" });
    if (error) throw new Error("Impossible d'initialiser la double authentification.");
    enrolement = { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  return (
    <CarteConnexion
      titre="Double authentification"
      description={
        enrolement
          ? "Obligatoire pour les administrateurs. Scannez ce QR code avec votre application d'authentification, puis saisissez le code affiché."
          : "Saisissez le code affiché par votre application d'authentification."
      }
    >
      {enrolement && (
        <div className="grid justify-items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code SVG fourni par Supabase en data URI */}
          <img
            src={enrolement.qrCode}
            alt="QR code de configuration"
            width={200}
            height={200}
            className="rounded bg-white p-2"
          />
          <p className="text-xs text-muted-foreground">
            Clé manuelle : <code className="break-all">{enrolement.secret}</code>
          </p>
        </div>
      )}
      <FormulaireCode2fa factorId={enrolement?.factorId ?? verifie!.id} suite={suite} />
      <form action={seDeconnecter}>
        <button type="submit" className="w-full text-sm text-muted-foreground underline">
          Se déconnecter
        </button>
      </form>
    </CarteConnexion>
  );
}
