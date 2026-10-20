import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { FormationEtat } from "@/lib/requetes/formations";

/** Champs communs à la saisie et à la modification d'une formation (hors agent et type). */
export function ChampsFormation({ formation, aujourdhui }: { formation?: FormationEtat; aujourdhui: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="date_formation"
          libelle="Date de la formation"
          type="date"
          required
          max={aujourdhui}
          defaultValue={formation?.date_formation}
        />
        <ChampTexte
          nom="duree_heures"
          libelle="Durée (heures)"
          type="number"
          min={0.5}
          max={9999}
          step={0.5}
          inputMode="decimal"
          defaultValue={formation?.duree_heures ?? ""}
          placeholder="Ex. : 14"
        />
      </div>
      <ChampTexte
        nom="organisme"
        libelle="Organisme de formation"
        maxLength={200}
        defaultValue={formation?.organisme ?? ""}
      />
      <ChampTexte
        nom="echeance"
        libelle="Échéance"
        type="date"
        defaultValue={formation?.echeance ?? ""}
        aide="Laissez vide pour la calculer d'après la validité de la formation (ex. 3 ans pour l'habilitation électrique)."
      />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={formation?.notes ?? ""} />
    </>
  );
}

export function ChampsAgentType({
  agents,
  types,
  agentId,
  typeId,
}: {
  agents: { id: string; nom: string }[];
  types: { id: string; libelle: string }[];
  agentId?: string;
  typeId?: string;
}) {
  return (
    <>
      <ChampListe
        nom="agent_id"
        libelle="Agent"
        vide="Nouvel agent (je le saisis ci-dessous)"
        defaultValue={agentId ?? ""}
        options={agents.map((a) => ({ valeur: a.id, libelle: a.nom }))}
      />
      <ChampTexte nom="agent_nouveau" libelle="Nom du nouvel agent" maxLength={200} autoComplete="off" />
      <ChampListe
        nom="type_formation_id"
        libelle="Formation"
        vide="Nouvelle formation (je la saisis ci-dessous)"
        defaultValue={typeId ?? ""}
        options={types.map((t) => ({ valeur: t.id, libelle: t.libelle }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="type_nouveau"
          libelle="Intitulé de la nouvelle formation"
          maxLength={200}
          placeholder="Ex. : Habilitation électrique"
          autoComplete="off"
        />
        <ChampTexte
          nom="validite_mois_nouveau"
          libelle="Validité (mois)"
          type="number"
          min={1}
          max={240}
          inputMode="numeric"
          placeholder="Ex. : 36"
          aide="Vide : sans échéance."
        />
      </div>
    </>
  );
}
