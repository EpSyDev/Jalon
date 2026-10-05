import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { BadgeAlerteContrat, messageAlerteContrat } from "@/components/alerte-contrat";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { alerteContrat, type AlerteContrat } from "@/lib/metier/contrats";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { listerContrats, seuilAEcheance } from "@/lib/requetes/contrats";

export const metadata = { title: "Contrats — Jalon" };

const ORDRE: (AlerteContrat | null)[] = ["echu", "preavis_depasse", "a_decider", null];

export default async function PageContrats() {
  const { contrats, seuil, peutEcrire } = await requete(async (tx, u) => ({
    contrats: await listerContrats(tx),
    seuil: await seuilAEcheance(tx),
    peutEcrire: u.role !== "lecture",
  }));
  const aujourdhui = aujourdhuiParis();
  const avecAlerte = contrats
    .map((c) => ({ ...c, alerte: alerteContrat(c, aujourdhui, seuil) }))
    .sort((a, b) => ORDRE.indexOf(a.alerte) - ORDRE.indexOf(b.alerte));

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contrats</h1>
        <div className="flex flex-wrap gap-2">
          <LienBouton href="/prestataires" variante="outline">
            Prestataires
          </LienBouton>
          {peutEcrire && (
            <LienBouton href="/contrats/nouveau">
              <Plus className="size-4" aria-hidden />
              Nouveau contrat
            </LienBouton>
          )}
        </div>
      </div>
      {avecAlerte.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucun contrat.</p>
      ) : (
        <ul className="grid gap-2">
          {avecAlerte.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contrats/${c.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="font-medium">{c.objet}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.prestataire_nom}
                    {c.reference && ` · ${c.reference}`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <BadgeAlerteContrat alerte={c.alerte} />
                    <span
                      className={c.alerte && c.alerte !== "a_decider" ? "text-destructive" : "text-muted-foreground"}
                    >
                      {c.alerte
                        ? messageAlerteContrat(c, c.alerte)
                        : c.date_fin
                          ? `Fin le ${formaterDate(c.date_fin)}`
                          : "Sans date de fin : aucune alerte possible"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
