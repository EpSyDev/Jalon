import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CircleAlert, CircleCheck, CircleDashed, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { BarresHorizontales, Histogramme, type PointHistogramme } from "@/components/graphiques";
import { requete } from "@/lib/auth";
import { LIBELLES_PRIORITE, PRIORITES } from "@/lib/metier/interventions";
import { listerPlans } from "@/lib/requetes/controles";
import { cn } from "@/lib/utils";

export const metadata = { title: "Statistiques — Jalon" };

function Tuile({
  libelle,
  valeur,
  detail,
  icone,
  ton,
}: {
  libelle: string;
  valeur: string | number;
  detail?: string;
  icone?: ReactNode;
  ton?: "rouge" | "violet" | "ambre" | "vert";
}) {
  const couleurs = {
    rouge: "text-red-600 dark:text-red-400",
    violet: "text-violet-600 dark:text-violet-400",
    ambre: "text-amber-600 dark:text-amber-400",
    vert: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="grid gap-1 rounded-lg border p-4">
      <span className={cn("flex items-center gap-1.5 text-sm", ton ? couleurs[ton] : "text-muted-foreground")}>
        {icone}
        {libelle}
      </span>
      <span className="text-3xl font-semibold tabular-nums">{valeur}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

const mois = (iso: string) => ({
  etiquette: format(parseISO(iso), "MMM", { locale: fr }).replace(".", ""),
  libelle: format(parseISO(iso), "MMMM yyyy", { locale: fr }),
});

const jours = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function PageStatistiques() {
  const d = await requete(async (tx) => {
    const [plans, controles, interventions, delais, [reserves], [contrats]] = await Promise.all([
      listerPlans(tx),
      tx<
        { mois: string; realises: number; avec_ecarts: number }[]
      >`select * from public.v_stats_controles_mois order by mois`,
      tx<
        { mois: string; creees: number; terminees: number }[]
      >`select * from public.v_stats_interventions_mois order by mois`,
      tx<
        {
          priorite: (typeof PRIORITES)[number];
          terminees: number;
          delai_moyen_jours: number;
          delai_median_jours: number;
        }[]
      >`
        select * from public.v_stats_delais_interventions`,
      tx<
        {
          ouvertes: number;
          ouvertes_en_retard: number;
          ouvertes_critiques: number;
          ouvertes_majeures: number;
          ouvertes_mineures: number;
          ouvertes_sans_gravite: number;
          levees_12_mois: number;
          delai_median_levee_jours: number | null;
        }[]
      >`select * from public.v_stats_reserves`,
      tx<
        { actifs: number; montant_annuel_total: number; sans_montant: number }[]
      >`select * from public.v_stats_contrats`,
    ]);
    return { plans, controles, interventions, delais, reserves, contrats };
  });

  const compte = (s: string) => d.plans.filter((p) => p.statut_echeance === s).length;
  const pointsControles: PointHistogramme[] = d.controles.map((c) => ({
    ...mois(c.mois),
    valeurs: [c.realises],
    complement: c.avec_ecarts ? `dont ${c.avec_ecarts} avec réserves ou non conforme(s)` : undefined,
  }));
  const pointsInterventions: PointHistogramme[] = d.interventions.map((i) => ({
    ...mois(i.mois),
    valeurs: [i.creees, i.terminees],
  }));
  const delais = [...PRIORITES]
    .reverse()
    .flatMap((p) => d.delais.filter((x) => x.priorite === p))
    .map((x) => ({
      libelle: LIBELLES_PRIORITE[x.priorite],
      valeur: x.delai_median_jours,
      affichage: jours(x.delai_median_jours),
      detail: `${x.terminees} terminée${x.terminees > 1 ? "s" : ""} · moyenne ${jours(x.delai_moyen_jours)}`,
    }));
  const r = d.reserves;

  return (
    <div className="mx-auto grid max-w-4xl gap-8 p-4 md:p-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Statistiques</h1>
        <p className="text-sm text-muted-foreground">
          Chiffres bruts issus des données saisies. Aucun indicateur ne vaut attestation de conformité.
        </p>
      </div>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Contrôles ({d.plans.length} plans suivis)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tuile
            libelle="En retard"
            valeur={compte("en_retard")}
            ton="rouge"
            icone={<CircleAlert className="size-4" aria-hidden />}
          />
          <Tuile
            libelle="Jamais contrôlés"
            valeur={compte("jamais_controle")}
            ton="violet"
            icone={<CircleDashed className="size-4" aria-hidden />}
          />
          <Tuile
            libelle="À échéance"
            valeur={compte("a_echeance")}
            ton="ambre"
            icone={<Clock className="size-4" aria-hidden />}
          />
          <Tuile
            libelle="À jour"
            valeur={compte("a_jour")}
            ton="vert"
            icone={<CircleCheck className="size-4" aria-hidden />}
          />
        </div>
        <div className="rounded-lg border p-4">
          <Histogramme
            titre="Contrôles réalisés par mois"
            unite="contrôles"
            series={[{ nom: "Réalisés", couleur: "serie-1" }]}
            points={pointsControles}
          />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Réserves</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tuile
            libelle="Ouvertes"
            valeur={r.ouvertes}
            detail={`${r.ouvertes_critiques} critique(s) · ${r.ouvertes_majeures} majeure(s) · ${r.ouvertes_mineures} mineure(s) · ${r.ouvertes_sans_gravite} à qualifier`}
          />
          <Tuile
            libelle="À lever en retard"
            valeur={r.ouvertes_en_retard}
            ton={r.ouvertes_en_retard ? "rouge" : undefined}
            icone={r.ouvertes_en_retard ? <CircleAlert className="size-4" aria-hidden /> : undefined}
          />
          <Tuile libelle="Levées sur 12 mois" valeur={r.levees_12_mois} />
          <Tuile
            libelle="Délai médian de levée"
            valeur={r.delai_median_levee_jours === null ? "—" : jours(r.delai_median_levee_jours)}
            detail="entre constat et levée, 12 derniers mois"
          />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Interventions</h2>
        <div className="rounded-lg border p-4">
          <Histogramme
            titre="Interventions créées et terminées par mois"
            unite="interventions"
            series={[
              { nom: "Créées", couleur: "serie-1" },
              { nom: "Terminées", couleur: "serie-2" },
            ]}
            points={pointsInterventions}
          />
        </div>
        <div className="rounded-lg border p-4">
          <BarresHorizontales
            titre="Délai médian de réalisation par priorité (12 mois)"
            lignes={delais}
            vide="Aucune intervention terminée sur les 12 derniers mois."
          />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Contrats</h2>
        <div className="grid grid-cols-2 gap-3">
          <Tuile libelle="Contrats en cours" valeur={d.contrats.actifs} />
          <Tuile
            libelle="Montant annuel cumulé"
            valeur={euros.format(d.contrats.montant_annuel_total)}
            detail={
              d.contrats.sans_montant
                ? `${d.contrats.sans_montant} contrat(s) sans montant renseigné`
                : "HT, contrats en cours"
            }
          />
        </div>
      </section>
    </div>
  );
}
