import { PageSquelette } from "@/components/page-squelette";
import { exigerUtilisateur } from "@/lib/auth";

export const metadata = { title: "Paramètres — Jalon" };

export default async function PageParametres() {
  await exigerUtilisateur(["admin"]);
  return (
    <PageSquelette
      titre="Paramètres"
      bloc="B5"
      description="Seuils de rappel, destinataires des mails, jour du récapitulatif hebdomadaire, utilisateurs."
    />
  );
}
