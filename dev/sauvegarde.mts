// Sauvegarde complète vers sauvegardes/ (hors Vercel/Supabase).
// Usage : npm run sauvegarde
// Base distante : DATABASE_URL=postgres://… npm run sauvegarde
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { exporterBase } from "../src/lib/sauvegarde.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant.");
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  const sauvegarde = await exporterBase({
    requete: (texte, params) => sql.unsafe(texte, (params ?? []) as never[]) as never,
  });
  const dossier = join(process.cwd(), "sauvegardes");
  mkdirSync(dossier, { recursive: true });
  const fichier = join(dossier, `jalon-${sauvegarde.cree_le.slice(0, 19).replace(/[:T]/g, "-")}.json`);
  writeFileSync(fichier, JSON.stringify(sauvegarde));
  const total = Object.values(sauvegarde.tables).reduce((n, lignes) => n + lignes.length, 0);
  // Mémorise l'export pour l'alerte « sauvegarde trop ancienne » (clé identique à metier/sauvegarde.ts).
  await sql`
    insert into public.parametres (cle, valeur, description)
    values ('derniere_sauvegarde', to_jsonb(now()::text), 'Instant de la dernière sauvegarde téléchargée.')
    on conflict (cle) do update set valeur = excluded.valeur`;
  console.log(`Sauvegarde écrite : ${fichier} (${total} lignes, schéma ${sauvegarde.migration}).`);
  console.log("À copier sur un support indépendant (réseau de l'établissement, disque chiffré).");
} finally {
  await sql.end();
}
