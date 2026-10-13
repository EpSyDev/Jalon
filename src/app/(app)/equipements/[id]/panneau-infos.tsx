"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { Formulaire } from "@/components/formulaire";
import { Button } from "@/components/ui/button";
import { formaterDate } from "@/lib/format";
import type { EquipementDetail, OptionsEquipement } from "@/lib/requetes/parc";
import { ChampsEquipement } from "../champs-equipement";

function Info({ libelle, valeur, large }: { libelle: string; valeur: string | null; large?: boolean }) {
  return (
    <div className={large ? "col-span-2 grid gap-0.5" : "grid gap-0.5"}>
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd className="break-words whitespace-pre-line">{valeur ?? "—"}</dd>
    </div>
  );
}

type Action = (formData: FormData) => Promise<{ erreur: string } | { message: string } | undefined>;

/** Informations de l'équipement, modifiables sur la fiche même (« Modifier » ouvre le formulaire à leur place). */
export function PanneauInfos({
  equipement: e,
  options,
  action,
  archiver,
  supprimer,
  ouvertParDefaut = false,
}: {
  equipement: EquipementDetail;
  options: OptionsEquipement;
  /** Absente pour un compte en lecture seule. */
  action?: Action;
  /** Administrateur seulement. */
  archiver?: Action;
  /** Administrateur seulement : suppression définitive (refusée si l'équipement a un historique). */
  supprimer?: Action;
  ouvertParDefaut?: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut && Boolean(action));
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section aria-labelledby="titre-infos" className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titre-infos" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Informations
        </h2>
        {action && (
          <Button
            variant={ouvert ? "ghost" : "outline"}
            className="h-11"
            onClick={() => {
              setMessage(null);
              setOuvert(!ouvert);
            }}
          >
            {ouvert ? (
              "Annuler"
            ) : (
              <>
                <Pencil className="size-4" aria-hidden />
                Modifier
              </>
            )}
          </Button>
        )}
      </div>
      {message && !ouvert && (
        <p role="status" className="rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </p>
      )}
      {ouvert && action ? (
        <div className="grid gap-6">
          <Formulaire
            action={action}
            libelle="Enregistrer"
            onSucces={(m) => {
              setMessage(m);
              setOuvert(false);
            }}
          >
            <ChampsEquipement options={options} equipement={e} />
          </Formulaire>
          {archiver && (
            <div className="grid gap-3 border-t pt-6">
              <Formulaire
                action={archiver}
                libelle="Archiver cet équipement"
                variante="outline"
                confirmation="Archiver cet équipement ? Son QR code ne fonctionnera plus. L'historique est conservé."
              />
              {supprimer && <BoutonSupprimer action={supprimer} nom="cet équipement" />}
            </div>
          )}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Info libelle="Univers" valeur={e.univers} />
          <Info libelle="Catégorie" valeur={e.categorie} />
          <Info libelle="Marque" valeur={e.marque} />
          <Info libelle="Modèle" valeur={e.modele} />
          <Info libelle="N° de série" valeur={e.numero_serie} />
          <Info libelle="Mise en service" valeur={e.date_mise_en_service && formaterDate(e.date_mise_en_service)} />
          <Info libelle="Localisation" valeur={e.localisation} large />
          {e.notes && <Info libelle="Notes" valeur={e.notes} large />}
        </dl>
      )}
    </section>
  );
}
