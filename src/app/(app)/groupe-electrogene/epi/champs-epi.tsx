import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { EpiListe } from "@/lib/requetes/groupe-electrogene";

export function ChampsEpi({
  epi,
  localisations,
}: {
  epi?: EpiListe;
  localisations: { id: string; libelle: string }[];
}) {
  return (
    <>
      <ChampTexte
        nom="libelle"
        libelle="EPI"
        required
        maxLength={200}
        defaultValue={epi?.libelle}
        placeholder="Ex. : Gants isolants"
      />
      <ChampTexte
        nom="detail"
        libelle="Détail"
        maxLength={120}
        defaultValue={epi?.detail ?? ""}
        placeholder="Ex. : classe 0, taille 10"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="quantite"
          libelle="Quantité"
          type="number"
          min={1}
          max={9999}
          required
          defaultValue={epi?.quantite ?? 1}
          inputMode="numeric"
        />
        <ChampTexte
          nom="date_peremption"
          libelle="Date de péremption"
          type="date"
          defaultValue={epi?.date_peremption ?? ""}
          aide="Celle indiquée sur l'équipement ou par le fabricant. Laisser vide si aucune."
        />
      </div>
      <ChampListe
        nom="localisation_id"
        libelle="Rangé à"
        vide="Non renseigné"
        defaultValue={epi?.localisation_id ?? ""}
        options={localisations.map((l) => ({ valeur: l.id, libelle: l.libelle }))}
      />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={epi?.notes ?? ""} />
    </>
  );
}
