import { ChampListe, ChampTexte, ChampZoneTexte, versOptions } from "@/components/champs";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { LIBELLES_STATUT_CHANTIER } from "@/lib/metier/interventions";
import type { Chantier } from "@/lib/requetes/interventions";

export function ChampsChantier({
  responsables,
  chantier,
}: {
  responsables: { id: string; libelle: string }[];
  chantier?: Chantier;
}) {
  return (
    <>
      <ChampTexte nom="titre" libelle="Titre" required maxLength={200} defaultValue={chantier?.titre} />
      <ChampListe
        nom="statut"
        libelle="Statut"
        defaultValue={chantier?.statut ?? "prevu"}
        options={versOptions(LIBELLES_STATUT_CHANTIER)}
      />
      <ChampListe
        nom="responsable_id"
        libelle="Responsable"
        defaultValue={chantier?.responsable_id ?? ""}
        vide="Non désigné"
        options={responsables.map((r) => ({ valeur: r.id, libelle: r.libelle }))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <ChampTexte nom="date_debut" libelle="Début" type="date" defaultValue={chantier?.date_debut ?? ""} />
        <ChampTexte
          nom="date_fin_prevue"
          libelle="Fin prévue"
          type="date"
          defaultValue={chantier?.date_fin_prevue ?? ""}
        />
        <ChampTexte
          nom="date_fin_reelle"
          libelle="Fin réelle"
          type="date"
          max={aujourdhuiParis()}
          defaultValue={chantier?.date_fin_reelle ?? ""}
        />
      </div>
      <ChampZoneTexte nom="description" libelle="Description" defaultValue={chantier?.description ?? ""} />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={chantier?.notes ?? ""} />
    </>
  );
}
