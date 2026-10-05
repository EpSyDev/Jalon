import { PageSquelette } from "@/components/page-squelette";

export const metadata = { title: "Contrôles réglementaires — Jalon" };

export default function PageControles() {
  return (
    <PageSquelette
      titre="Contrôles réglementaires"
      bloc="B1"
      description="Types et plans de contrôle, saisie rapide d'un contrôle, réserves, échéances calculées."
    />
  );
}
