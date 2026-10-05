import { PageSquelette } from "@/components/page-squelette";

export const metadata = { title: "Parc matériel — Jalon" };

export default function PageEquipements() {
  return (
    <PageSquelette
      titre="Parc matériel"
      bloc="B6"
      description="Équipements, localisations et fiches accessibles par QR code."
    />
  );
}
