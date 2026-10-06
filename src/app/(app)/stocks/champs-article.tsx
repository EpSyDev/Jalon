import { ChampTexte, ChampZoneTexte } from "@/components/champs";
import type { ArticleStock } from "@/lib/requetes/stocks";

export function ChampsArticle({ article }: { article?: ArticleStock }) {
  return (
    <>
      <ChampTexte nom="libelle" libelle="Libellé" required maxLength={200} defaultValue={article?.libelle} />
      <div className="grid gap-4 sm:grid-cols-3">
        <ChampTexte nom="reference" libelle="Référence" maxLength={60} defaultValue={article?.reference ?? ""} />
        <ChampTexte
          nom="unite"
          libelle="Unité"
          maxLength={20}
          defaultValue={article?.unite ?? ""}
          placeholder="u, m, L…"
        />
        <ChampTexte
          nom="seuil_alerte"
          libelle="Seuil d'alerte"
          inputMode="decimal"
          defaultValue={article?.seuil_alerte ? Number(article.seuil_alerte).toLocaleString("fr-FR") : ""}
          aide="Signalé quand le stock descend à ce niveau."
        />
      </div>
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={article?.notes ?? ""} />
    </>
  );
}
