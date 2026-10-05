import { ChampListe, ChampTexte, ChampZoneTexte, versOptions } from "@/components/champs";
import { Badge } from "@/components/ui/badge";
import { LIBELLES_PRIORITE, LIBELLES_TYPE_INTERVENTION, type PRIORITES } from "@/lib/metier/interventions";
import type { InterventionDetail, optionsIntervention } from "@/lib/requetes/interventions";
import { cn } from "@/lib/utils";

type Options = Awaited<ReturnType<typeof optionsIntervention>>;

const liste = (l: { id: string; libelle: string }[]) => l.map((o) => ({ valeur: o.id, libelle: o.libelle }));

export function ChampsIntervention({
  options,
  intervention,
  defauts = {},
}: {
  options: Options;
  intervention?: InterventionDetail;
  defauts?: { equipement_id?: string; plan_controle_id?: string; chantier_id?: string };
}) {
  // Un lien existant vers un chantier clos reste sélectionnable en modification.
  const chantiers =
    intervention?.chantier_id && !options.chantiers.some((c) => c.id === intervention.chantier_id)
      ? [
          { id: intervention.chantier_id, libelle: intervention.chantier_titre ?? "Chantier clos" },
          ...options.chantiers,
        ]
      : options.chantiers;
  return (
    <>
      <ChampTexte
        nom="titre"
        libelle="Titre"
        required
        maxLength={200}
        defaultValue={intervention?.titre}
        placeholder="Ex. : fuite sur vanne d'arrêt"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampListe
          nom="priorite"
          libelle="Priorité"
          defaultValue={intervention?.priorite ?? "normale"}
          options={versOptions(LIBELLES_PRIORITE)}
        />
        <ChampListe
          nom="type"
          libelle="Type"
          defaultValue={intervention?.type ?? "corrective"}
          options={versOptions(LIBELLES_TYPE_INTERVENTION)}
        />
      </div>
      <ChampListe
        nom="equipement_id"
        libelle="Équipement"
        defaultValue={intervention?.equipement_id ?? defauts.equipement_id ?? ""}
        vide="Aucun"
        options={liste(options.equipements)}
      />
      <ChampZoneTexte nom="description" libelle="Description" defaultValue={intervention?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampListe
          nom="assignee_id"
          libelle="Assignée à"
          defaultValue={intervention?.assignee_id ?? ""}
          vide="Personne"
          options={liste(options.intervenants)}
        />
        <ChampTexte
          nom="date_prevue"
          libelle="Date prévue"
          type="date"
          defaultValue={intervention?.date_prevue ?? ""}
        />
      </div>
      <ChampListe
        nom="prestataire_id"
        libelle="Prestataire"
        defaultValue={intervention?.prestataire_id ?? ""}
        vide="Aucun (réalisée en interne)"
        options={liste(options.prestataires)}
      />
      <ChampListe
        nom="chantier_id"
        libelle="Chantier"
        defaultValue={intervention?.chantier_id ?? defauts.chantier_id ?? ""}
        vide="Aucun"
        options={liste(chantiers)}
      />
      <ChampListe
        nom="plan_controle_id"
        libelle="Liée au plan de contrôle"
        defaultValue={intervention?.plan_controle_id ?? defauts.plan_controle_id ?? ""}
        vide="Aucun"
        options={liste(options.plans)}
        aide="Ex. : intervention pour lever une réserve."
      />
    </>
  );
}

const STYLE_PRIORITE: Record<(typeof PRIORITES)[number], string> = {
  urgente: "bg-red-600 text-white border-transparent dark:bg-red-500",
  haute: "bg-amber-400 text-black border-transparent",
  normale: "",
  basse: "text-muted-foreground",
};

export function BadgePriorite({ priorite }: { priorite: (typeof PRIORITES)[number] }) {
  return (
    <Badge variant="outline" className={cn(STYLE_PRIORITE[priorite])}>
      {LIBELLES_PRIORITE[priorite]}
    </Badge>
  );
}
