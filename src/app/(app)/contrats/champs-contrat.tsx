import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { Contrat } from "@/lib/requetes/contrats";

export function ChampsContrat({
  prestataires,
  contrat,
  prestataireParDefaut,
}: {
  prestataires: { id: string; libelle: string }[];
  contrat?: Contrat;
  prestataireParDefaut?: string;
}) {
  return (
    <>
      <ChampListe
        nom="prestataire_id"
        libelle="Prestataire"
        required
        defaultValue={contrat?.prestataire_id ?? prestataireParDefaut ?? ""}
        vide="Choisir…"
        options={prestataires.map((p) => ({ valeur: p.id, libelle: p.libelle }))}
      />
      <ChampTexte nom="objet" libelle="Objet" required maxLength={300} defaultValue={contrat?.objet} />
      <ChampTexte nom="reference" libelle="Référence" maxLength={120} defaultValue={contrat?.reference ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="date_debut" libelle="Début" type="date" defaultValue={contrat?.date_debut ?? ""} />
        <ChampTexte
          nom="date_fin"
          libelle="Fin"
          type="date"
          defaultValue={contrat?.date_fin ?? ""}
          aide="Indispensable pour recevoir l'alerte de préavis."
        />
        <ChampTexte
          nom="preavis_jours"
          libelle="Préavis (jours)"
          type="number"
          inputMode="numeric"
          min={0}
          max={730}
          defaultValue={contrat?.preavis_jours ?? ""}
        />
        <ChampTexte
          nom="montant_annuel"
          libelle="Montant annuel (€ HT)"
          inputMode="decimal"
          defaultValue={contrat?.montant_annuel?.replace(".", ",") ?? ""}
          placeholder="Ex. : 4 800"
        />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input
          type="checkbox"
          name="reconduction_tacite"
          defaultChecked={contrat?.reconduction_tacite}
          className="size-5"
        />
        Reconduction tacite
      </label>
      <ChampTexte
        nom="reference_document"
        libelle="Document du contrat"
        maxLength={500}
        defaultValue={contrat?.reference_document ?? ""}
        placeholder="Chemin réseau ou lien GED"
      />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={contrat?.notes ?? ""} />
    </>
  );
}
