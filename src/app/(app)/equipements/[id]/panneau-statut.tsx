"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { BadgeStatutEquipement } from "@/components/badges";
import { ChampListe, ChampTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { Button } from "@/components/ui/button";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  AIDES_STATUT_EQUIPEMENT,
  estIndisponible,
  GROUPES_STATUT,
  LIBELLES_STATUT_EQUIPEMENT,
  type StatutEquipement,
} from "@/lib/metier/parc";
import { cn } from "@/lib/utils";

type Action = (formData: FormData) => Promise<{ erreur: string } | { message: string } | undefined>;

const enFrancais = (iso: string) => iso.split("-").reverse().join("/");

/** Statut actuel de l'équipement ; « Changer le statut » ouvre le formulaire sur place. */
export function PanneauStatut({
  statut,
  depuis,
  motif,
  prestataire,
  retourPrevu,
  prestataires,
  interventionOuverte,
  action,
  peutEcrire,
}: {
  statut: StatutEquipement;
  depuis: string | null;
  motif: string | null;
  prestataire: string | null;
  retourPrevu: string | null;
  prestataires: { id: string; libelle: string }[];
  /** Une intervention est déjà ouverte : on ne propose pas d'en créer une autre par défaut. */
  interventionOuverte: boolean;
  action: Action;
  peutEcrire: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState<StatutEquipement>(statut);
  const [message, setMessage] = useState<string | null>(null);
  const aujourdhui = aujourdhuiParis();
  const retardRetour = retourPrevu !== null && retourPrevu < aujourdhui && estIndisponible(statut);
  const reparation = choisi === "reparation_interne" || choisi === "reparation_externe";

  return (
    <section
      aria-labelledby="titre-statut"
      className={cn(
        "grid gap-3 rounded-lg border bg-card p-4",
        estIndisponible(statut) && "border-amber-500/60",
        statut === "hors_service" && "border-red-600/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h2 id="titre-statut" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Statut
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatutEquipement statut={statut} className="h-7 px-3 text-sm" />
            {depuis && <span className="text-sm text-muted-foreground">depuis le {enFrancais(depuis)}</span>}
          </div>
          {(motif || prestataire || retourPrevu) && (
            <dl className="grid gap-1 text-sm">
              {prestataire && (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Chez :</dt>
                  <dd>{prestataire}</dd>
                </div>
              )}
              {retourPrevu && (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Retour prévu :</dt>
                  <dd className={cn(retardRetour && "font-semibold text-red-700 dark:text-red-400")}>
                    {enFrancais(retourPrevu)}
                    {retardRetour && " (dépassé)"}
                  </dd>
                </div>
              )}
              {motif && (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Motif :</dt>
                  <dd className="whitespace-pre-line">{motif}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
        {peutEcrire && !ouvert && (
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setChoisi(statut === "en_service" ? "indisponible" : "en_service");
              setMessage(null);
              setOuvert(true);
            }}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
            Changer le statut
          </Button>
        )}
        {ouvert && (
          <Button variant="ghost" className="h-11" onClick={() => setOuvert(false)}>
            Annuler
          </Button>
        )}
      </div>

      {message && !ouvert && (
        <p role="status" className="rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </p>
      )}

      {ouvert && (
        <Formulaire
          action={action}
          libelle="Enregistrer le statut"
          onSucces={(m) => {
            setMessage(m);
            setOuvert(false);
          }}
          className="border-t pt-4"
        >
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Nouveau statut</legend>
            {GROUPES_STATUT.map((g) => (
              <div key={g.libelle} className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">{g.libelle}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.statuts.map((s) => (
                    <label
                      key={s}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm",
                        choisi === s && "border-primary bg-primary/5",
                      )}
                    >
                      <input
                        type="radio"
                        name="statut"
                        value={s}
                        checked={choisi === s}
                        onChange={() => setChoisi(s)}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="grid gap-0.5">
                        <span className="font-medium">
                          {LIBELLES_STATUT_EQUIPEMENT[s]}
                          {s === statut && <span className="font-normal text-muted-foreground"> (actuel)</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{AIDES_STATUT_EQUIPEMENT[s]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <ChampTexte
              nom="statut_depuis"
              libelle="Depuis le"
              type="date"
              max={aujourdhui}
              defaultValue={aujourdhui}
            />
            {estIndisponible(choisi) && (
              <ChampTexte
                nom="statut_retour_prevu"
                libelle="Retour prévu"
                type="date"
                min={aujourdhui}
                aide="Facultatif. Signalé s'il est dépassé."
              />
            )}
          </div>
          {choisi === "reparation_externe" && (
            <ChampListe
              nom="statut_prestataire_id"
              libelle="Chez quel prestataire"
              vide={prestataires.length ? "Non renseigné" : "Aucun prestataire enregistré"}
              options={prestataires.map((p) => ({ valeur: p.id, libelle: p.libelle }))}
            />
          )}
          <ChampTexte
            nom="statut_motif"
            libelle={choisi === "en_service" ? "Commentaire" : "Motif"}
            maxLength={500}
            placeholder={choisi === "en_service" ? "Ex. : remis en service après réparation" : "Ex. : roue cassée"}
            aide="Aucune donnée patient."
          />
          {reparation && (
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                name="creer_intervention"
                defaultChecked={!interventionOuverte}
                className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
              />
              <span>
                Ouvrir une intervention de suivi
                <span className="block text-xs text-muted-foreground">
                  {interventionOuverte
                    ? "Une intervention est déjà ouverte sur cet équipement."
                    : "Elle apparaîtra dans Interventions, avec le retour prévu comme date."}
                </span>
              </span>
            </label>
          )}
        </Formulaire>
      )}
    </section>
  );
}
