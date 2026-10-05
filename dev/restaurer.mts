// Restauration d'une sauvegarde dans une base vierge (migrations appliquées, aucune donnée métier).
// Usage : npm run restaurer -- sauvegardes/jalon-….json --confirmer [--comptes-locaux]
//   --comptes-locaux : crée les comptes manquants (base locale de développement uniquement).
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { restaurerBase, type Sauvegarde } from "../src/lib/sauvegarde.ts";

const args = process.argv.slice(2);
const fichier = args.find((a) => !a.startsWith("--"));
const url = process.env.DATABASE_URL;
if (!fichier || !args.includes("--confirmer") || !url) {
  console.error("Usage : npm run restaurer -- <fichier.json> --confirmer [--comptes-locaux]");
  process.exit(1);
}
const sauvegarde = JSON.parse(readFileSync(fichier, "utf8")) as Sauvegarde;
const local = ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  const bilan = await sql.begin(async (tx) => {
    if (args.includes("--comptes-locaux")) {
      if (!local) throw new Error("--comptes-locaux est réservé à une base locale.");
      for (const p of sauvegarde.tables.profils) {
        await tx`insert into auth.users (id) values (${p.id as string}) on conflict do nothing`;
      }
    }
    return restaurerBase(
      { requete: (texte, params) => tx.unsafe(texte, (params ?? []) as never[]) as never },
      sauvegarde,
    );
  });
  console.log("Restauration terminée :", bilan);
} catch (e) {
  console.error("Restauration annulée :", (e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
