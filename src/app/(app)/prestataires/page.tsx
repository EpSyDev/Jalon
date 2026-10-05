import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { listerPrestataires } from "@/lib/requetes/contrats";

export const metadata = { title: "Prestataires — Jalon" };

const compter = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export default async function PagePrestataires() {
  const { prestataires, peutEcrire } = await requete(async (tx, u) => ({
    prestataires: await listerPrestataires(tx),
    peutEcrire: u.role !== "lecture",
  }));

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Prestataires</h1>
        <div className="flex flex-wrap gap-2">
          <LienBouton href="/contrats" variante="outline">
            Contrats
          </LienBouton>
          {peutEcrire && (
            <LienBouton href="/prestataires/nouveau">
              <Plus className="size-4" aria-hidden />
              Nouveau prestataire
            </LienBouton>
          )}
        </div>
      </div>
      {prestataires.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Aucun prestataire.</p>
      ) : (
        <ul className="grid gap-2">
          {prestataires.map((p) => (
            <li key={p.id}>
              <Link
                href={`/prestataires/${p.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="font-medium">{p.nom}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {[p.contact_nom, p.telephone].filter(Boolean).join(" · ") || "Coordonnées à compléter"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {[
                      compter(p.nb_contrats, "contrat"),
                      compter(p.nb_plans, "contrôle"),
                      p.nb_interventions_ouvertes > 0 &&
                        `${p.nb_interventions_ouvertes} intervention${p.nb_interventions_ouvertes > 1 ? "s ouvertes" : " ouverte"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
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
