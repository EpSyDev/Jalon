import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LienBouton } from "@/components/lien-bouton";
import { requete } from "@/lib/auth";
import { formaterDate } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { formaterValeur, horsSeuil, libelleSeuils, LIBELLES_STATUT_RELEVE, prochainReleve } from "@/lib/metier/releves";
import { avecEtat, historiqueReleves, lirePoint } from "@/lib/requetes/releves";
import { cn } from "@/lib/utils";
import { SaisieRapide } from "../saisie-rapide";

export const metadata = { title: "Point de relevé — Jalon" };

export default async function PagePoint({ params }: PageProps<"/releves/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const donnees = await requete(async (tx, u) => {
    const point = await lirePoint(tx, id);
    return point ? { point, historique: await historiqueReleves(tx, id), peutEcrire: u.role !== "lecture" } : null;
  });
  if (!donnees) notFound();
  const { historique, peutEcrire } = donnees;
  const p = avecEtat(donnees.point, aujourdhuiParis());
  const seuils = libelleSeuils(p.seuil_min, p.seuil_max, p.unite);
  const prochain = prochainReleve(p.dernier_releve, p.periodicite_jours);

  return (
    <div className="mx-auto grid max-w-2xl gap-4 p-4 md:p-8">
      <Link href="/releves" className="text-sm text-muted-foreground underline">
        ← Relevés
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{p.libelle}</h1>
        <p className="text-sm text-muted-foreground">
          {[
            p.equipement_code,
            p.localisation,
            `tous les ${p.periodicite_jours} jour${p.periodicite_jours > 1 ? "s" : ""}`,
            seuils && `seuils : ${seuils}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm">
          {LIBELLES_STATUT_RELEVE[p.statut]}
          {prochain && p.statut !== "du_jour" && ` · prochain relevé le ${formaterDate(prochain)}`}
          {!p.actif && " · point inactif"}
        </p>
        {p.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{p.notes}</p>}
      </div>

      {peutEcrire && p.actif && (
        <section className="grid gap-2 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Nouveau relevé</h2>
          <SaisieRapide pointId={p.id} unite={p.unite} libelle={p.libelle} />
        </section>
      )}
      {peutEcrire && (
        <LienBouton href={`/releves/${p.id}/modifier`} variante="outline" className="h-12 text-base">
          Modifier le point
        </LienBouton>
      )}

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Historique ({historique.length})</h2>
        {historique.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun relevé.</p>
        ) : (
          <ol className="grid gap-1.5">
            {historique.map((r) => {
              const depasse = horsSeuil(r.valeur, p.seuil_min, p.seuil_max);
              return (
                <li
                  key={r.id}
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-card p-3 text-sm",
                    depasse && "border-destructive",
                  )}
                >
                  <span>
                    <span className="font-medium">{formaterDate(r.date_releve)}</span>
                    {r.saisi_par && <span className="text-muted-foreground"> · {r.saisi_par}</span>}
                    {r.commentaire && <span className="block text-muted-foreground">{r.commentaire}</span>}
                  </span>
                  <span className={cn("font-mono text-base", depasse && "font-semibold text-destructive")}>
                    {formaterValeur(r.valeur, p.unite)}
                    {depasse && (depasse === "bas" ? " ↓ sous le seuil" : " ↑ au-dessus du seuil")}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
