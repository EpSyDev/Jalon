import Link from "next/link";
import { ChampTexte, ChampZoneTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { libelleValidite } from "@/lib/metier/formations";
import { referentielFormations, type Agent, type TypeFormation } from "@/lib/requetes/formations";
import {
  archiverAgent,
  archiverTypeFormation,
  creerAgent,
  creerTypeFormation,
  modifierAgent,
  modifierTypeFormation,
} from "../actions";

export const metadata = { title: "Agents et formations — Jalon" };

function ChampsAgent({ agent }: { agent?: Agent }) {
  return (
    <>
      <ChampTexte nom="nom" libelle="Nom" required maxLength={200} defaultValue={agent?.nom} autoComplete="off" />
      <ChampTexte nom="fonction" libelle="Fonction" maxLength={120} defaultValue={agent?.fonction ?? ""} />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={agent?.notes ?? ""} />
    </>
  );
}

function ChampsType({ type }: { type?: TypeFormation }) {
  return (
    <>
      <ChampTexte
        nom="libelle"
        libelle="Formation"
        required
        maxLength={200}
        defaultValue={type?.libelle}
        placeholder="Ex. : Habilitation électrique"
        autoComplete="off"
      />
      <ChampTexte
        nom="validite_mois"
        libelle="Validité (mois)"
        type="number"
        min={1}
        max={240}
        inputMode="numeric"
        defaultValue={type?.validite_mois ?? ""}
        placeholder="Ex. : 36 pour 3 ans"
        aide="Vide : sans échéance. Un changement ne modifie pas les échéances déjà calculées."
      />
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={type?.notes ?? ""} />
    </>
  );
}

export default async function PageReferentielFormations() {
  const { agents, types, role } = await requete(
    async (tx, u) => ({ ...(await referentielFormations(tx)), role: u.role }),
    ["admin", "technicien"],
  );

  return (
    <div className="mx-auto grid max-w-3xl gap-8 p-4 md:p-8">
      <Link href="/formations" className="text-sm text-muted-foreground underline">
        ← Formations
      </Link>
      <h1 className="text-2xl font-semibold">Agents et formations</h1>

      <section className="grid gap-3" aria-labelledby="titre-types">
        <h2 id="titre-types" className="text-lg font-semibold">
          Formations et validité ({types.length})
        </h2>
        <ul className="grid gap-2">
          {types.map((t) => (
            <li key={t.id}>
              <details className="rounded-lg border bg-card p-3">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 font-medium">
                  {t.libelle}
                  <span className="text-sm font-normal text-muted-foreground">{libelleValidite(t.validite_mois)}</span>
                </summary>
                <div className="grid gap-3 pt-3">
                  <Formulaire action={modifierTypeFormation.bind(null, t.id)} libelle="Enregistrer">
                    <ChampsType type={t} />
                  </Formulaire>
                  {role === "admin" && (
                    <Formulaire
                      action={archiverTypeFormation.bind(null, t.id)}
                      libelle="Archiver"
                      variante="outline"
                      confirmation="Archiver cette formation ? Elle disparaît du suivi."
                    />
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details className="rounded-lg border border-dashed p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Ajouter une formation</summary>
          <div className="pt-3">
            <Formulaire action={creerTypeFormation} libelle="Ajouter" reinitialiser>
              <ChampsType />
            </Formulaire>
          </div>
        </details>
      </section>

      <section className="grid gap-3" aria-labelledby="titre-agents">
        <h2 id="titre-agents" className="text-lg font-semibold">
          Agents ({agents.length})
        </h2>
        <ul className="grid gap-2">
          {agents.map((a) => (
            <li key={a.id}>
              <details className="rounded-lg border bg-card p-3">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 font-medium">
                  {a.nom}
                  {a.fonction && <span className="text-sm font-normal text-muted-foreground">{a.fonction}</span>}
                </summary>
                <div className="grid gap-3 pt-3">
                  <Formulaire action={modifierAgent.bind(null, a.id)} libelle="Enregistrer">
                    <ChampsAgent agent={a} />
                  </Formulaire>
                  {role === "admin" && (
                    <Formulaire
                      action={archiverAgent.bind(null, a.id)}
                      libelle="Archiver"
                      variante="outline"
                      confirmation="Archiver cet agent ? Il disparaît du suivi (départ du service, par exemple)."
                    />
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details className="rounded-lg border border-dashed p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Ajouter un agent</summary>
          <div className="pt-3">
            <Formulaire action={creerAgent} libelle="Ajouter" reinitialiser>
              <ChampsAgent />
            </Formulaire>
          </div>
        </details>
      </section>
    </div>
  );
}
