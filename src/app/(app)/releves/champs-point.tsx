import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { PointReleve } from "@/lib/requetes/releves";

type Option = { id: string; libelle: string };

export function ChampsPoint({
  options,
  point,
}: {
  options: { equipements: Option[]; localisations: Option[] };
  point?: PointReleve;
}) {
  const nombre = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
  return (
    <>
      <ChampTexte
        nom="libelle"
        libelle="Ce qu'on relève"
        required
        maxLength={200}
        defaultValue={point?.libelle}
        placeholder="Ex. : Température départ eau chaude"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="periodicite_jours"
          libelle="Tous les combien de jours ?"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={366}
          defaultValue={point?.periodicite_jours}
        />
        <ChampTexte
          nom="unite"
          libelle="Unité"
          maxLength={20}
          defaultValue={point?.unite ?? ""}
          placeholder="°C, bar, m³…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="seuil_min"
          libelle="Seuil minimal"
          inputMode="decimal"
          defaultValue={nombre(point?.seuil_min)}
          aide="Facultatif."
        />
        <ChampTexte
          nom="seuil_max"
          libelle="Seuil maximal"
          inputMode="decimal"
          defaultValue={nombre(point?.seuil_max)}
          aide="Facultatif. Une valeur hors seuil est signalée sur « Aujourd'hui »."
        />
      </div>
      <ChampListe
        nom="equipement_id"
        libelle="Équipement"
        defaultValue={point?.equipement_id ?? ""}
        vide="Aucun"
        options={options.equipements.map((o) => ({ valeur: o.id, libelle: o.libelle }))}
      />
      <ChampListe
        nom="localisation_id"
        libelle="Localisation"
        defaultValue={point?.localisation_id ?? ""}
        vide="Aucune"
        options={options.localisations.map((o) => ({ valeur: o.id, libelle: o.libelle }))}
      />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={point?.notes ?? ""} />
      {point ? (
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" name="actif" defaultChecked={point.actif} className="size-5" />
          Point actif (génère des relevés à faire et des alertes)
        </label>
      ) : (
        <input type="hidden" name="actif" value="on" />
      )}
    </>
  );
}
