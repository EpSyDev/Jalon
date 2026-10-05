// Prépare une base PGlite comme le ferait Supabase : environnement simulé, migrations
// appliquées dans l'ordre et tracées, seed fictif au premier démarrage.
// Utilisé par les tests (base en mémoire) et par le serveur de dev (base persistée).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

const RACINE = process.cwd();
const DOSSIER_MIGRATIONS = join(RACINE, "supabase", "migrations");

function lire(...chemin: string[]): string {
  return readFileSync(join(RACINE, ...chemin), "utf8");
}

export async function preparerBase(db: PGlite): Promise<{ appliquees: string[]; seedee: boolean }> {
  const { rows } = await db.query<{ existe: boolean }>(
    "select exists (select 1 from pg_namespace where nspname = 'auth') as existe",
  );
  const neuve = !rows[0].existe;

  if (neuve) {
    await db.exec(lire("dev", "stub-supabase.sql"));
    await db.exec(`
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (version text primary key);
    `);
  }

  const dejaFaites = new Set(
    (await db.query<{ version: string }>("select version from supabase_migrations.schema_migrations")).rows.map(
      (r) => r.version,
    ),
  );
  const appliquees: string[] = [];
  for (const fichier of readdirSync(DOSSIER_MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const version = fichier.split("_")[0];
    if (dejaFaites.has(version)) continue;
    try {
      await db.transaction(async (tx) => {
        await tx.exec(lire("supabase", "migrations", fichier));
        await tx.query("insert into supabase_migrations.schema_migrations (version) values ($1)", [version]);
      });
    } catch (e) {
      throw new Error(`Migration ${fichier} : ${(e as Error).message}`);
    }
    appliquees.push(fichier);
  }

  if (neuve) {
    await db.exec(lire("dev", "utilisateurs-locaux.sql"));
    await db.exec(lire("supabase", "seed", "02_donnees.sql"));
  }
  return { appliquees, seedee: neuve };
}
