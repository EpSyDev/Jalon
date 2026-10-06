import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import type { EquipementDetail, optionsEquipement } from "@/lib/requetes/parc";

type Options = Awaited<ReturnType<typeof optionsEquipement>>;

export const LIBELLES_STATUT_EQUIPEMENT = {
  en_service: "En service",
  hors_service: "Hors service",
  reforme: "Réformé",
} as const;

export function ChampsEquipement({
  options,
  equipement,
  universParDefaut,
}: {
  options: Options;
  equipement?: EquipementDetail;
  universParDefaut?: string;
}) {
  return (
    <>
      <ChampListe
        nom="univers_id"
        libelle="Univers"
        defaultValue={equipement?.univers_id ?? universParDefaut ?? ""}
        vide="Aucun univers"
        options={options.univers.map((u) => ({ valeur: u.id, libelle: u.libelle }))}
        aide={
          options.univers.length === 0
            ? "Aucun univers : créez-en dans Parc → Univers pour regrouper vos matériels."
            : "Domaine auquel appartient ce matériel."
        }
      />
      <ChampTexte
        nom="code"
        libelle="Code"
        required
        maxLength={60}
        defaultValue={equipement?.code}
        placeholder="Ex. : TGBT-A"
        aide="Unique et lisible, sans espace. Il sert aussi au rattachement lors des imports."
      />
      <ChampTexte nom="libelle" libelle="Libellé" required maxLength={200} defaultValue={equipement?.libelle} />
      <ChampListe
        nom="statut"
        libelle="Statut"
        defaultValue={equipement?.statut ?? "en_service"}
        options={Object.entries(LIBELLES_STATUT_EQUIPEMENT).map(([valeur, libelle]) => ({ valeur, libelle }))}
        aide="Un équipement réformé ne génère plus d'alerte."
      />
      <ChampListe
        nom="famille_id"
        libelle="Famille"
        defaultValue={equipement?.famille_id ?? ""}
        vide="Non renseignée"
        options={options.familles.map((f) => ({ valeur: f.id, libelle: f.libelle }))}
      />
      <ChampListe
        nom="localisation_id"
        libelle="Localisation"
        defaultValue={equipement?.localisation_id ?? ""}
        vide="Non renseignée"
        options={options.localisations.map((l) => ({ valeur: l.id, libelle: l.libelle }))}
        aide="Nouvelle localisation : Parc → Localisations."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="marque" libelle="Marque" maxLength={120} defaultValue={equipement?.marque ?? ""} />
        <ChampTexte nom="modele" libelle="Modèle" maxLength={120} defaultValue={equipement?.modele ?? ""} />
        <ChampTexte
          nom="numero_serie"
          libelle="N° de série"
          maxLength={120}
          defaultValue={equipement?.numero_serie ?? ""}
        />
        <ChampTexte
          nom="date_mise_en_service"
          libelle="Mise en service"
          type="date"
          max={aujourdhuiParis()}
          defaultValue={equipement?.date_mise_en_service ?? ""}
        />
      </div>
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={equipement?.notes ?? ""} />
    </>
  );
}
