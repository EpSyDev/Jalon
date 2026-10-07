import type { ReactNode } from "react";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { messageAlerteContrat } from "@/components/alerte-contrat";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import { requete } from "@/lib/auth";
import { formaterDate, LIBELLES_GRAVITE } from "@/lib/format";
import { alerteContrat, type AlerteContrat } from "@/lib/metier/contrats";
import { aujourdhuiParis, FUSEAU } from "@/lib/metier/echeance";
import { donneesAujourdhui, type ContratSuivi } from "@/lib/requetes/aujourdhui";
import { donneesRelais } from "@/lib/requetes/relais";

export const metadata = { title: "Passage de relais — Jalon" };

const STATUTS = { a_faire: "À faire", en_cours: "En cours", en_attente: "En attente" } as const;
const LIGNE = "grid gap-0.5 border-b border-dashed py-1.5 text-sm last:border-0";

function Bloc({ titre, vide, nombre, children }: { titre: string; vide: string; nombre: number; children: ReactNode }) {
  return (
    <section className="grid gap-2 break-inside-avoid">
      <h2 className="border-b pb-1 text-lg font-semibold">
        {titre} <span className="text-sm font-normal text-muted-foreground">({nombre})</span>
      </h2>
      {nombre === 0 ? <p className="text-sm text-muted-foreground">{vide}</p> : <ul>{children}</ul>}
    </section>
  );
}

/** État du service sur une page imprimable, pour un remplaçant (congés, absence). */
export default async function PageRelais() {
  const aujourdhui = aujourdhuiParis();
  const { auj, relais } = await requete(async (tx) => ({
    auj: await donneesAujourdhui(tx),
    relais: await donneesRelais(tx),
  }));
  const parStatut = (s: string) => auj.plans.filter((p) => p.statut_echeance === s);
  const retards = [...parStatut("en_retard"), ...parStatut("jamais_controle")];
  const proches = parStatut("a_echeance");
  const contrats = auj.contrats
    .map((c) => ({ c, alerte: alerteContrat(c, aujourdhui, auj.seuilJours) }))
    .filter((x): x is { c: ContratSuivi; alerte: AlerteContrat } => x.alerte !== null);
  const graves = auj.reserves.filter((r) => r.gravite === "critique" || r.gravite === "majeure");
  const nbReserves = auj.reserves.length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8 print:max-w-none print:gap-4 print:p-0">
      <header className="grid gap-2">
        <p className="surtitre">Service technique · passage de relais</p>
        <h1 className="text-3xl">État du service</h1>
        <p className="text-sm text-muted-foreground">
          Au {formatInTimeZone(new Date(), FUSEAU, "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}. Document de travail
          interne : il aide au suivi, il ne certifie aucune conformité.
        </p>
        <div className="print:hidden">
          <BoutonImprimer />
        </div>
      </header>

      <Bloc titre="Contrôles en retard ou jamais contrôlés" nombre={retards.length} vide="Aucun.">
        {retards.map((p) => (
          <li key={p.plan_controle_id} className={LIGNE}>
            <span className="font-medium">{p.type_libelle}</span>
            <span className="text-muted-foreground">
              {[p.equipement_code, p.perimetre, p.prestataire_nom].filter(Boolean).join(" · ")} ·{" "}
              {p.prochaine_echeance ? `échéance dépassée le ${formaterDate(p.prochaine_echeance)}` : "jamais contrôlé"}
            </span>
          </li>
        ))}
      </Bloc>

      <Bloc titre={`Échéances dans les ${auj.seuilJours} jours`} nombre={proches.length} vide="Aucune.">
        {proches.map((p) => (
          <li key={p.plan_controle_id} className={LIGNE}>
            <span className="font-medium">
              {formaterDate(p.prochaine_echeance)} · {p.type_libelle}
            </span>
            <span className="text-muted-foreground">
              {[p.equipement_code, p.perimetre, p.prestataire_nom].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </Bloc>

      <Bloc titre="Interventions en cours" nombre={relais.interventions.length} vide="Aucune.">
        {relais.interventions.map((i) => (
          <li key={i.id} className={LIGNE}>
            <span className="font-medium">
              {i.priorite === "urgente" && "URGENT · "}
              {i.titre}
            </span>
            <span className="text-muted-foreground">
              {[STATUTS[i.statut], i.equipement_code, i.prestataire_nom, `demandée le ${formaterDate(i.date_demande)}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </Bloc>

      <Bloc
        titre="Réserves ouvertes majeures ou critiques"
        nombre={graves.length}
        vide={`Aucune (${nbReserves} réserve${nbReserves > 1 ? "s" : ""} ouverte${nbReserves > 1 ? "s" : ""} au total).`}
      >
        {graves.map((r) => (
          <li key={r.id} className={LIGNE}>
            <span className="font-medium">{r.description}</span>
            <span className="text-muted-foreground">
              {r.gravite && LIBELLES_GRAVITE[r.gravite]} · {r.type_libelle}
              {r.echeance_levee && ` · à lever avant le ${formaterDate(r.echeance_levee)}`}
            </span>
          </li>
        ))}
      </Bloc>

      <Bloc titre="Contrats : décision à prendre" nombre={contrats.length} vide="Aucune décision en vue.">
        {contrats.map(({ c, alerte }) => (
          <li key={c.id} className={LIGNE}>
            <span className="font-medium">
              {c.objet} · {c.prestataire_nom}
            </span>
            <span className="text-muted-foreground">{messageAlerteContrat(c, alerte)}</span>
          </li>
        ))}
      </Bloc>

      <Bloc titre="Prestataires clés" nombre={relais.prestataires.length} vide="Aucun prestataire rattaché.">
        {relais.prestataires.map((p) => (
          <li key={p.id} className={LIGNE}>
            <span className="font-medium">
              {p.nom}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {p.nb_plans} contrôle{p.nb_plans > 1 ? "s" : ""}, {p.nb_contrats} contrat
                {p.nb_contrats > 1 ? "s" : ""}
              </span>
            </span>
            <span className="text-muted-foreground">
              {[p.contact_nom, p.telephone, p.email].filter(Boolean).join(" · ") || "Aucun contact renseigné"}
            </span>
          </li>
        ))}
      </Bloc>
    </div>
  );
}
