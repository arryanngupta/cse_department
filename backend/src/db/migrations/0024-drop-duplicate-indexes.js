/**
 * Remove duplicate UNIQUE indexes left behind by `sequelize.sync({ alter: true })`.
 *
 * Each `sync({ alter: true })` run added another unique index on the same
 * column instead of recognising the existing one, leaving:
 *
 *   users.email        11 indexes (email, email_2 … email_10, users_email)
 *   info_blocks.key    11 indexes (key, key_2 … key_10, info_blocks_key)
 *   people.slug        10 indexes (slug, slug_2 … slug_10)
 *
 * Why it matters: every INSERT and UPDATE maintains all of them, so writes do
 * roughly 10x the index work they need to. MySQL also caps a table at 64
 * indexes — `users` and `info_blocks` were already at 12 of 64 and would grow
 * on each future sync until ALTER TABLE started failing outright.
 *
 * The fix keeps exactly one unique index per column and drops the rest. It is
 * written data-driven rather than as a fixed DROP list so it is safe on a
 * database with a different amount of accumulated bloat (including none, on a
 * freshly migrated database where there is nothing to do).
 *
 * The real remedy is never running `sync({ alter: true })` again — the call in
 * src/index.js is commented out and must stay that way. See
 * docs/database-migration.md.
 */

/** Columns that should carry exactly one unique index. */
const UNIQUE_COLUMNS = [
  { table: 'users', column: 'email' },
  { table: 'info_blocks', column: 'key' },
  { table: 'people', column: 'slug' },
];

/**
 * Index names on `table.column`, excluding the primary key, with whether each
 * one is unique.
 *
 * Uniqueness is the thing that must survive. These columns carry a mix of
 * unique and non-unique indexes — `users` had a non-unique `users_email`
 * alongside a unique `email` — so the survivor has to be chosen by
 * `non_unique`, never by name. Choosing by name drops the real constraint and
 * silently allows duplicate emails.
 */
const indexesOn = async (queryInterface, table, column) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT DISTINCT index_name AS name, non_unique
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
        AND index_name <> 'PRIMARY'
      ORDER BY non_unique ASC, index_name ASC`,
    { replacements: [table, column] },
  );
  return rows.map((r) => ({ name: r.name, unique: Number(r.non_unique) === 0 }));
};

const tableExists = async (queryInterface, table) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] },
  );
  return Number(rows[0].n) > 0;
};

export async function up(queryInterface) {
  for (const { table, column } of UNIQUE_COLUMNS) {
    if (!(await tableExists(queryInterface, table))) continue;

    const indexes = await indexesOn(queryInterface, table, column);
    if (indexes.length <= 1) continue; // Already clean.

    // Ordered unique-first by the query, so the first entry is a unique index
    // whenever one exists.
    const survivor = indexes[0];

    for (const index of indexes) {
      if (index.name === survivor.name) continue;

      // A foreign key can depend on an index; skip rather than fail the run.
      try {
        await queryInterface.removeIndex(table, index.name);
      } catch (error) {
        console.warn(
          `  could not drop ${table}.${index.name}: ${error?.parent?.code || error.message}`,
        );
      }
    }

    const remaining = await indexesOn(queryInterface, table, column);
    console.log(
      `  ${table}.${column}: ${indexes.length} -> ${remaining.length} index(es)` +
        ` (kept ${survivor.name}, unique=${survivor.unique})`,
    );
  }
}

export async function down() {
  // Deliberately not reversible. The dropped indexes were accidental
  // duplicates of a constraint that still exists; recreating them would
  // restore a defect, not a feature.
}
