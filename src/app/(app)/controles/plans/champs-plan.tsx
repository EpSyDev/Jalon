import { ChampListe, ChampTexte } from "@/components/champs";
import type { optionsPlan, PlanDetail } from "@/lib/requetes/controles";

type Options = Awaited<ReturnType<typeof optionsPlan>>;

const versListe = (liste: { id: string; libelle: string }[]) =>
  liste.map((o) => ({ valeur: o.id, libelle: o.libelle }));

/** Champs communs à la création et à la modification d'un plan de contrôle. */
export function ChampsPlan({ options, plan }: { options: Options; plan?: PlanDetail }) {
  return (
    <>
      <ChampListe
        nom="type_controle_id"
        libelle="Type de contrôle"
        required
        defaultValue={plan?.type_controle_id ?? ""}
        vide="Choisir…"
        options={options.types.map((t) => ({ valeur: t.id, libelle: `${t.libelle} (${t.periodicite_mois} mois)` }))}
      />
      <ChampListe
        nom="equipement_id"
        libelle="Équipement"
        defaultValue={plan?.equipement_id ?? ""}
        vide="Aucun (installation entière)"
        options={versListe(options.equipements)}
      />
      <ChampTexte
        nom="perimetre_libelle"
        libelle="Périmètre"
        maxLength={200}
        defaultValue={plan?.perimetre_libelle ?? ""}
        placeholder="Ex. : ensemble du site, bâtiment B"
        aide="Obligatoire si aucun équipement n'est choisi."
      />
      <ChampListe
        nom="prestataire_id"
        libelle="Prestataire"
        defaultValue={plan?.prestataire_id ?? ""}
        vide="Non renseigné"
        options={versListe(options.prestataires)}
      />
      <ChampListe
        nom="contrat_id"
        libelle="Contrat"
        defaultValue={plan?.contrat_id ?? ""}
        vide="Non renseigné"
        options={versListe(options.contrats)}
      />
      <ChampTexte
        nom="periodicite_mois_surcharge"
        libelle="Périodicité spécifique (mois)"
        type="number"
        inputMode="numeric"
        min={1}
        max={120}
        defaultValue={plan?.periodicite_mois_surcharge ?? ""}
        aide="Laisser vide pour appliquer la périodicité du type."
      />
      {plan ? (
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" name="actif" defaultChecked={plan.actif} className="size-5" />
          Plan actif (génère échéances et alertes)
        </label>
      ) : (
        <input type="hidden" name="actif" value="on" />
      )}
    </>
  );
}
