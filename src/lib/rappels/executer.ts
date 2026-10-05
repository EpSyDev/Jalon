import "server-only";
import { avecServiceRole } from "@/lib/db";
import { lireEnvRappels } from "@/lib/env";
import { composerMail } from "@/lib/mail/composer";
import { envoyerMail } from "@/lib/mail/envoi";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import {
  aEnregistrer,
  calculerRappels,
  cleRappel,
  normaliserSeuils,
  type EntreeRappels,
  type Rappel,
} from "@/lib/metier/rappels";

export type BilanRappels = { envoye: boolean; rappels: number; recap: boolean; message: string };

/** Exécution complète : lecture, calcul, un seul mail, enregistrement après succès uniquement. */
export async function executerRappels(): Promise<BilanRappels> {
  const env = lireEnvRappels();
  const aujourdhui = aujourdhuiParis();

  const { entree, destinataires } = await avecServiceRole(async (tx) => {
    const parametres = new Map(
      (await tx<{ cle: string; valeur: unknown }[]>`select cle, valeur from public.parametres`).map((p) => [
        p.cle,
        p.valeur,
      ]),
    );
    const [plans, contrats, reserves, envoyes] = await Promise.all([
      tx<EntreeRappels["plans"]>`
        select plan_controle_id as id, type_libelle as libelle, coalesce(equipement_code, perimetre) as perimetre,
          prochaine_echeance as echeance, statut_echeance as statut
        from public.v_plans_controle_echeance`,
      tx<EntreeRappels["contrats"]>`
        select c.id, c.objet, p.nom as prestataire, c.date_fin, c.preavis_jours
        from public.contrats c join public.prestataires p on p.id = c.prestataire_id
        where c.archive_le is null and c.date_fin is not null`,
      tx<EntreeRappels["reserves"]>`
        select r.id, r.description, pl.id as plan_id, t.libelle as plan_libelle, r.echeance_levee
        from public.reserves r
        join public.controles c on c.id = r.controle_id and c.archive_le is null
        join public.plans_controle pl on pl.id = c.plan_controle_id and pl.archive_le is null and pl.actif
        join public.types_controle t on t.id = pl.type_controle_id
        where r.statut = 'ouverte' and r.archive_le is null`,
      tx<Pick<Rappel, "cible_type" | "cible_id" | "seuil" | "echeance">[]>`
        select cible_type, cible_id, seuil, echeance from public.rappels_envoyes
        where echeance >= ${aujourdhui}::date - 400`,
    ]);
    const seuilsParam = parametres.get("seuils_rappel_jours");
    const seuils = normaliserSeuils(Array.isArray(seuilsParam) ? seuilsParam : []);
    const destinataires = parametres.get("destinataires_rappels");
    return {
      destinataires: Array.isArray(destinataires) ? (destinataires as string[]) : [],
      entree: {
        aujourdhui,
        seuils: seuils.length ? seuils : [60, 30, 7],
        jourRecap: Number(parametres.get("jour_recap_hebdo") ?? 1),
        plans,
        contrats,
        reserves,
        dejaEnvoyes: new Set(envoyes.map(cleRappel)),
      } satisfies EntreeRappels,
    };
  });

  const resultat = calculerRappels(entree);
  const bilan = { rappels: resultat.rappels.length, recap: resultat.recap !== null };
  if (!bilan.rappels && !bilan.recap) return { ...bilan, envoye: false, message: "Rien à envoyer aujourd'hui." };
  if (destinataires.length === 0) {
    return { ...bilan, envoye: false, message: "Aucun destinataire configuré : rien n'a été envoyé." };
  }

  await envoyerMail(env, destinataires, composerMail(resultat, env.APP_URL));

  const lignes = aEnregistrer(resultat);
  await avecServiceRole(async (tx) => {
    await tx`insert into public.rappels_envoyes ${tx(lignes)} on conflict do nothing`;
  });
  const nb = destinataires.length;
  return { ...bilan, envoye: true, message: `Mail envoyé à ${nb} destinataire${nb > 1 ? "s" : ""}.` };
}
