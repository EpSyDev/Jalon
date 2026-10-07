// Sauvegarde / restauration indépendantes de Supabase et Vercel.
// Paramètre JSON passé en texte ($1::text::json) : les pilotes ne le resérialisent pas.
// Aucune dépendance : utilisable par l'application, les scripts (node) et les tests (PGlite).
// Les données sont sérialisées par Postgres (json_agg) pour un format stable quel que soit le pilote.

export type Executeur = { requete: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]> };

export const FORMAT = "jalon-sauvegarde";
export const VERSION_FORMAT = 1;

/** Ordre compatible avec les clés étrangères. Toute nouvelle table doit être ajoutée ici (test dédié). */
export const TABLES = [
  "profils",
  "parametres",
  "localisations",
  "prestataires",
  "contacts",
  "familles_controle",
  "univers",
  "equipements",
  "points_releve",
  "releves",
  "contrats",
  "types_controle",
  "plans_controle",
  "controles",
  "reserves",
  "chantiers",
  "interventions",
  "rappels_envoyes",
  "articles_stock",
  "mouvements_stock",
  "journal_audit",
] as const;

const TRI: Partial<Record<(typeof TABLES)[number], string>> = {
  journal_audit: "id",
  parametres: "cle",
  rappels_envoyes: "envoye_le, id",
};

/** Tables déjà alimentées par les migrations ou les comptes : fusionnées plutôt qu'insérées. */
const FUSIONNEES: Record<string, string> = { profils: "id", parametres: "cle" };

export type Sauvegarde = {
  format: typeof FORMAT;
  version: number;
  cree_le: string;
  migration: string | null;
  tables: Record<string, Record<string, unknown>[]>;
};

async function derniereMigration(x: Executeur): Promise<string | null> {
  const [r] = await x
    .requete<{ v: string | null }>("select max(version) as v from supabase_migrations.schema_migrations")
    .catch(() => [{ v: null }]);
  return r?.v ?? null;
}

export async function exporterBase(x: Executeur): Promise<Sauvegarde> {
  const tables: Sauvegarde["tables"] = {};
  for (const t of TABLES) {
    const tri = TRI[t] ?? "created_at, id";
    const [r] = await x.requete<{ donnees: string }>(
      `select coalesce(json_agg(t order by ${tri}), '[]')::text as donnees from public.${t} t`,
    );
    tables[t] = JSON.parse(r.donnees);
  }
  return {
    format: FORMAT,
    version: VERSION_FORMAT,
    cree_le: new Date().toISOString(),
    migration: await derniereMigration(x),
    tables,
  };
}

export type BilanRestauration = Record<string, number>;

/**
 * Restaure une sauvegarde dans une base au même schéma et sans données métier.
 * L'appelant fournit un exécuteur DANS une transaction : tout est annulé à la moindre erreur.
 * Les triggers (audit, garde-fous) sont suspendus le temps de l'opération : l'historique est repris tel quel.
 */
export async function restaurerBase(x: Executeur, s: Sauvegarde): Promise<BilanRestauration> {
  if (s?.format !== FORMAT || s.version !== VERSION_FORMAT) throw new Error("Fichier de sauvegarde non reconnu.");
  const manquantes = TABLES.filter((t) => !Array.isArray(s.tables?.[t]));
  if (manquantes.length) throw new Error(`Sauvegarde incomplète : ${manquantes.join(", ")}.`);

  const migration = await derniereMigration(x);
  if (s.migration && migration && s.migration !== migration) {
    throw new Error(
      `Schéma différent (sauvegarde ${s.migration}, base ${migration}) : appliquez les mêmes migrations.`,
    );
  }

  for (const t of TABLES.filter((t) => !(t in FUSIONNEES) && t !== "journal_audit")) {
    const [{ n }] = await x.requete<{ n: number }>(`select count(*)::int as n from public.${t}`);
    if (n > 0) throw new Error(`La base cible n'est pas vide (table ${t}) : restauration refusée.`);
  }
  // Seules entrées tolérées dans le journal cible : la création des comptes avant restauration.
  const [{ autres }] = await x.requete<{ autres: number }>(
    "select count(*)::int as autres from public.journal_audit where table_cible <> 'profils'",
  );
  if (autres > 0) throw new Error("La base cible n'est pas vide (journal_audit) : restauration refusée.");

  const ids = s.tables.profils.map((p) => p.id as string);
  if (ids.length) {
    const [{ n }] = await x.requete<{ n: number }>(
      "select count(*)::int as n from auth.users where id = any($1::uuid[])",
      [ids],
    );
    if (n !== ids.length) {
      throw new Error(
        `${ids.length - n} compte(s) utilisateur absent(s) de la base cible : créez-les avant de restaurer.`,
      );
    }
  }

  // DDL transactionnel : en cas d'erreur, l'annulation de la transaction rétablit aussi les triggers.
  const bilan: BilanRestauration = {};
  for (const t of TABLES) await x.requete(`alter table public.${t} disable trigger user`);
  // Le journal restauré remplace les traces d'amorçage des comptes.
  await x.requete("delete from public.journal_audit");
  {
    for (const t of TABLES) {
      const lignes = s.tables[t];
      bilan[t] = lignes.length;
      if (!lignes.length) continue;
      const colonnes = (
        await x.requete<{ c: string }>(
          `select column_name as c from information_schema.columns
           where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER' order by ordinal_position`,
          [t],
        )
      ).map((r) => `"${r.c}"`);
      const liste = colonnes.join(", ");
      const cle = FUSIONNEES[t];
      const fusion = cle
        ? ` on conflict (${cle}) do update set ${colonnes
            .filter((c) => c !== `"${cle}"`)
            .map((c) => `${c} = excluded.${c}`)
            .join(", ")}`
        : "";
      const identite = t === "journal_audit" ? " overriding system value" : "";
      await x.requete(
        `insert into public.${t} (${liste})${identite} select ${liste} from json_populate_recordset(null::public.${t}, $1::text::json)${fusion}`,
        [JSON.stringify(lignes)],
      );
    }
    await x.requete(
      "select setval(pg_get_serial_sequence('public.journal_audit', 'id'), greatest((select max(id) from public.journal_audit), 1))",
    );
  }
  for (const t of TABLES) await x.requete(`alter table public.${t} enable trigger user`);
  return bilan;
}
