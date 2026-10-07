import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { Contact } from "@/lib/requetes/contacts";

export function ChampsContact({
  contact,
  prestataires,
}: {
  contact?: Contact;
  prestataires: { id: string; libelle: string }[];
}) {
  return (
    <>
      <ChampTexte nom="nom" libelle="Nom" required maxLength={200} defaultValue={contact?.nom} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="organisation"
          libelle="Organisation"
          maxLength={200}
          defaultValue={contact?.organisation ?? ""}
          aide="Société, service, administration…"
        />
        <ChampTexte nom="fonction" libelle="Fonction" maxLength={120} defaultValue={contact?.fonction ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="telephone"
          libelle="Téléphone"
          type="tel"
          maxLength={30}
          defaultValue={contact?.telephone ?? ""}
        />
        <ChampTexte
          nom="email"
          libelle="Adresse mail"
          type="email"
          maxLength={254}
          defaultValue={contact?.email ?? ""}
        />
      </div>
      <ChampListe
        nom="prestataire_id"
        libelle="Prestataire lié"
        vide="Aucun"
        defaultValue={contact?.prestataire_id ?? ""}
        options={prestataires.map((p) => ({ valeur: p.id, libelle: p.libelle }))}
        aide="Facultatif : simple repère, sans effet sur les contrôles."
      />
      <ChampZoneTexte
        nom="notes"
        libelle="Notes"
        defaultValue={contact?.notes ?? ""}
        aide="Horaires, astreinte… Coordonnées professionnelles uniquement, aucune donnée patient."
      />
    </>
  );
}
