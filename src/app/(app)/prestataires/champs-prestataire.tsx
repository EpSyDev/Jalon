import { ChampTexte, ChampZoneTexte } from "@/components/champs";
import { LIBELLES_MODE_INTERVENTION, MODES_INTERVENTION } from "@/lib/metier/contrats";
import type { Prestataire } from "@/lib/requetes/contrats";

export function ChampsPrestataire({ prestataire }: { prestataire?: Prestataire }) {
  return (
    <>
      <ChampTexte nom="nom" libelle="Nom" required maxLength={200} defaultValue={prestataire?.nom} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Intervention</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {([...MODES_INTERVENTION, ""] as const).map((mode) => (
            <label
              key={mode}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 text-base has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="mode_intervention"
                value={mode}
                defaultChecked={(prestataire?.mode_intervention ?? "") === mode}
                className="size-5 accent-[var(--primary)]"
              />
              {mode === "" ? "Non précisé" : LIBELLES_MODE_INTERVENTION[mode]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          « Sur devis » : intervient (souvent chaque année) sans contrat, avec un devis à chaque fois.
        </p>
      </fieldset>
      <ChampTexte nom="contact_nom" libelle="Contact" maxLength={200} defaultValue={prestataire?.contact_nom ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte
          nom="email"
          libelle="Adresse mail"
          type="email"
          maxLength={254}
          defaultValue={prestataire?.email ?? ""}
        />
        <ChampTexte
          nom="telephone"
          libelle="Téléphone"
          type="tel"
          maxLength={30}
          defaultValue={prestataire?.telephone ?? ""}
        />
      </div>
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={prestataire?.notes ?? ""} />
    </>
  );
}
