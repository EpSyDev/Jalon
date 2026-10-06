import Link from "next/link";
import { ChampListe, ChampTexte, ChampZoneTexte } from "@/components/champs";
import { Formulaire } from "@/components/formulaire";
import { requete } from "@/lib/auth";
import { lireEnvRappels } from "@/lib/env";
import { LIBELLES_ROLE, type Role } from "@/lib/roles";
import { changerRole, enregistrerParametres, lancerRappels } from "./actions";

export const metadata = { title: "Paramètres — Jalon" };

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function modeMail(): { local: boolean; erreur?: string } {
  try {
    return { local: lireEnvRappels().MAIL_MODE === "local" };
  } catch {
    return { local: false, erreur: "Configuration des mails incomplète (CRON_SECRET, APP_URL, MAIL_MODE)." };
  }
}

export default async function PageParametres() {
  const { parametres, profils, utilisateur } = await requete(
    async (tx, u) => {
      const [lignes, profils] = await Promise.all([
        tx<{ cle: string; valeur: unknown }[]>`select cle, valeur from public.parametres`,
        tx<{ id: string; nom: string; role: Role; archive_le: Date | null }[]>`
          select id, nom, role, archive_le from public.profils order by archive_le nulls first, nom`,
      ]);
      return { parametres: new Map(lignes.map((l) => [l.cle, l.valeur])), profils, utilisateur: u };
    },
    ["admin"],
  );
  const destinataires = (parametres.get("destinataires_rappels") as string[] | undefined) ?? [];
  const seuils = (parametres.get("seuils_rappel_jours") as number[] | undefined) ?? [];
  const mail = modeMail();

  return (
    <div className="mx-auto grid max-w-3xl gap-8 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Paramètres</h1>

      <section className="grid gap-4 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">Échéances et rappels</h2>
        {destinataires.length === 0 && (
          <p role="alert" className="rounded-md bg-amber-400/20 p-3 text-sm">
            Aucun destinataire : aucun rappel ne sera envoyé tant que la liste est vide.
          </p>
        )}
        {mail.erreur && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {mail.erreur}
          </p>
        )}
        <Formulaire action={enregistrerParametres} libelle="Enregistrer">
          <ChampTexte
            nom="seuil_a_echeance_jours"
            libelle="Seuil « à échéance » (jours)"
            type="number"
            min={1}
            max={365}
            required
            defaultValue={Number(parametres.get("seuil_a_echeance_jours") ?? 60)}
            aide="Un plan passe « à échéance » quand sa prochaine échéance est à moins de ce nombre de jours."
          />
          <ChampTexte
            nom="seuils_rappel_jours"
            libelle="Seuils de rappel (jours avant l'échéance)"
            required
            defaultValue={seuils.join(", ")}
            aide="Jusqu'à 5 valeurs séparées par des virgules, ex. : 60, 30, 7."
          />
          <ChampZoneTexte
            nom="destinataires_rappels"
            libelle="Destinataires des rappels"
            defaultValue={destinataires.join("\n")}
            aide="Une adresse par ligne, 10 maximum."
          />
          <ChampListe
            nom="jour_recap_hebdo"
            libelle="Jour du récapitulatif hebdomadaire"
            defaultValue={String(parametres.get("jour_recap_hebdo") ?? 1)}
            options={JOURS.map((j, i) => ({ valeur: String(i + 1), libelle: j[0].toUpperCase() + j.slice(1) }))}
            aide="Envoyé même s'il n'y a rien en retard : son absence signale une panne."
          />
        </Formulaire>
        <div className="grid gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Les rappels partent automatiquement chaque matin. Vous pouvez aussi les déclencher maintenant : seuls les
            rappels pas encore envoyés partent.
          </p>
          <Formulaire action={lancerRappels} libelle="Envoyer les rappels maintenant" variante="outline" />
          {mail.local && (
            <Link href="/parametres/mails" className="text-sm underline">
              Voir les mails envoyés (mode local)
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">Sauvegarde</h2>
        <p className="text-sm text-muted-foreground">
          Export complet (toutes les tables, journal compris) à conserver hors de l&apos;hébergement : réseau de
          l&apos;établissement ou disque chiffré. À faire au moins chaque semaine tant que l&apos;offre gratuite de
          Supabase ne fournit pas de sauvegarde téléchargeable.
        </p>
        <a href="/api/sauvegarde" className="w-fit underline">
          Télécharger une sauvegarde (JSON)
        </a>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">Utilisateurs</h2>
        <p className="text-sm text-muted-foreground">
          Les comptes sont créés par invitation depuis Supabase ; un nouveau compte a le rôle « Lecture seule ».
        </p>
        <ul className="grid gap-3">
          {profils.map((p) => (
            <li key={p.id} className="grid gap-2 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {p.nom}
                  {p.id === utilisateur.id && " (vous)"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {p.archive_le ? "Désactivé" : LIBELLES_ROLE[p.role]}
                </span>
              </div>
              <Formulaire
                action={changerRole}
                libelle="Appliquer"
                variante="outline"
                className="sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <input type="hidden" name="id" value={p.id} />
                <ChampListe
                  nom="role"
                  libelle="Accès"
                  defaultValue={p.archive_le ? "desactive" : p.role}
                  options={[
                    ...Object.entries(LIBELLES_ROLE).map(([valeur, libelle]) => ({ valeur, libelle })),
                    { valeur: "desactive", libelle: "Désactivé (plus aucun accès)" },
                  ]}
                />
              </Formulaire>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
