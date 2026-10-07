import { Download } from "lucide-react";
import { requete } from "@/lib/auth";
import { listerUnivers } from "@/lib/requetes/parc";
import { FormulaireImport } from "./formulaire-import";

export const metadata = { title: "Import — Jalon" };

export default async function PageImport() {
  const univers = await requete((tx) => listerUnivers(tx), ["admin", "technicien"]);
  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Import Excel / CSV</h1>
        <p className="text-muted-foreground">
          Le fichier est d&apos;abord analysé ligne par ligne. Rien n&apos;est enregistré avant votre confirmation, et
          la moindre erreur bloque l&apos;import complet. Les éléments déjà présents sont ignorés : réimporter le même
          fichier ne crée pas de doublon.
        </p>
        <p className="text-sm text-muted-foreground">
          Conseil : importez les équipements avant les contrôles, pour que les codes d&apos;équipement soient reconnus.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href="/import/modele?type=controles" className="inline-flex items-center gap-2 underline">
          <Download className="size-4" aria-hidden />
          Modèle « Contrôles »
        </a>
        <a href="/import/modele?type=equipements" className="inline-flex items-center gap-2 underline">
          <Download className="size-4" aria-hidden />
          Modèle « Équipements »
        </a>
      </div>
      <FormulaireImport univers={univers.map((u) => ({ id: u.id, libelle: u.libelle }))} />
    </div>
  );
}
