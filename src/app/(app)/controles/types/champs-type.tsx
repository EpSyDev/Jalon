import { ChampListe, ChampTexte, ChampZoneTexte, versOptions } from "@/components/champs";
import { LIBELLES_CARACTERE } from "@/lib/format";
import type { Option, TypeControle } from "@/lib/requetes/controles";

/** Champs communs à la création et à la modification d'un type de contrôle. */
export function ChampsType({ familles, type }: { familles: Option[]; type?: TypeControle }) {
  return (
    <>
      <ChampTexte nom="libelle" libelle="Libellé" required maxLength={200} defaultValue={type?.libelle} />
      <ChampListe
        nom="famille_id"
        libelle="Famille"
        required
        defaultValue={type?.famille_id ?? ""}
        vide="Choisir…"
        options={familles.map((f) => ({ valeur: f.id, libelle: f.libelle }))}
      />
      <ChampListe
        nom="caractere"
        libelle="Caractère"
        required
        defaultValue={type?.caractere ?? ""}
        vide="Choisir…"
        options={versOptions(LIBELLES_CARACTERE)}
      />
      <ChampTexte
        nom="periodicite_mois"
        libelle="Périodicité (mois)"
        type="number"
        inputMode="numeric"
        required
        min={1}
        max={120}
        defaultValue={type?.periodicite_mois}
        aide="À reprendre du texte applicable : aucune valeur n'est proposée par défaut."
      />
      <ChampTexte
        nom="reference_texte"
        libelle="Référence du texte"
        maxLength={500}
        defaultValue={type?.reference_texte ?? ""}
        placeholder="Article, arrêté, référentiel…"
      />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={type?.notes ?? ""} />
    </>
  );
}
