// Base de développement locale : PGlite persisté dans .data/pglite, exposé en protocole Postgres.
// Usage : npm run db        (démarre, applique les nouvelles migrations)
//         npm run db:reset  (repart de zéro avec le seed fictif)

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { preparerBase } from "./base-locale.mts";

const DOSSIER = join(process.cwd(), ".data", "pglite");
const PORT = 54329;

if (process.argv.includes("--reset")) {
  rmSync(DOSSIER, { recursive: true, force: true });
  console.log("Base locale effacée.");
}

mkdirSync(DOSSIER, { recursive: true });
const db = await PGlite.create(DOSSIER);
const { appliquees, seedee } = await preparerBase(db);
if (seedee) console.log("Base neuve : seed fictif chargé.");
for (const m of appliquees) console.log(`Migration appliquée : ${m}`);

// Écoute uniquement en local : la base n'est jamais exposée au réseau.
const serveur = new PGLiteSocketServer({ db, host: "127.0.0.1", port: PORT, maxConnections: 20 });
await serveur.start();
console.log(`Base locale prête : postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);

async function arreter() {
  await serveur.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
