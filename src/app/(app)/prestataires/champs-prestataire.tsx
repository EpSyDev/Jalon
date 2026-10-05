import { ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { Prestataire } from "@/lib/requetes/contrats";

export function ChampsPrestataire({ prestataire }: { prestataire?: Prestataire }) {
  return (
    <>
      <ChampTexte nom="nom" libelle="Nom" required maxLength={200} defaultValue={prestataire?.nom} />
      <ChampTexte nom="contact_nom" libelle="Contact" maxLength={200} defaultValue={prestataire?.contact_nom ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="email"
          libelle="Adresse mail"
          type="email"
          maxLength={254}
          defaultValue={prestataire?.email ?? ""}
        />
        <ChampTexte
          nom="telephone"
          libelle="Téléphone"
          type="tel"
          maxLength={30}
          defaultValue={prestataire?.telephone ?? ""}
        />
      </div>
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={prestataire?.notes ?? ""} />
    </>
  );
}
