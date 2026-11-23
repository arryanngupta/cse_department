/**
 * Guarantee a UNIQUE index on the columns whose models declare `unique: true`.
 *
 * This repairs databases where an earlier revision of
 * 0024-drop-duplicate-indexes.js picked the surviving index by *name* rather
 * than by uniqueness. On `users.email` and `info_blocks.key` the
 * canonically-named index (`users_email`, `info_blocks_key`) happened to be
 * non-unique, so keeping it dropped the only real constraint and allowed
 * duplicate rows — a duplicate `admin@lnmiit.ac.in` could be inserted.
 *
 * 0024 now selects unique-first, so a database migrating from scratch never
 * hits the problem. This migration exists for the ones that already ran the
 * broken version, and is a no-op where the constraint is already intact.
 *
 * Duplicate values are reported rather than deleted. Silently removing user
 * accounts or content blocks to satisfy a constraint is not a decision a
 * migration should make on its own.
 */

const UNIQUE_COLUMNS = [
  { table: 'users', column: 'email', indexName: 'users_email_unique' },
  { table: 'info_blocks', column: 'key', indexName: 'info_blocks_key_unique' },
  { table: 'people', column: 'slug', indexName: 'people_slug_unique' },
];

const tableExists = async (queryInterface, table) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] },
  );
  return Number(rows[0].n) > 0;
};

const hasUniqueIndex = async (queryInterface, table, column) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COUNT(DISTINCT index_name) AS n
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
        AND non_unique = 0`,
    { replacements: [table, column] },
  );
  return Number(rows[0].n) > 0;
};

const duplicateValues = async (queryInterface, table, column) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT \`${column}\` AS value, COUNT(*) AS n
       FROM \`${table}\`
      WHERE \`${column}\` IS NOT NULL
      GROUP BY \`${column}\`
      HAVING n > 1`,
  );
  return rows;
};

export async function up(queryInterface) {
  for (const { table, column, indexName } of UNIQUE_COLUMNS) {
    if (!(await tableExists(queryInterface, table))) continue;

    if (await hasUniqueIndex(queryInterface, table, column)) {
      continue; // Constraint intact.
    }

    const dupes = await duplicateValues(queryInterface, table, column);
    if (dupes.length) {
      // Adding the index would fail anyway; stop with something actionable.
      const detail = dupes
        .map((d) => `${JSON.stringify(d.value)} (${d.n} rows)`)
        .join(', ');
      throw new Error(
        `Cannot add a unique index on ${table}.${column}: duplicate values ` +
          `already exist — ${detail}. Resolve these rows by hand, then re-run ` +
          '`npm run migrate`.',
      );
    }

    await queryInterface.addIndex(table, [column], {
      name: indexName,
      unique: true,
    });
    console.log(`  restored UNIQUE on ${table}.${column} (${indexName})`);
  }
}

export async function down(queryInterface) {
  // Only remove indexes this migration created; never strip a constraint the
  // schema legitimately depends on.
  for (const { table, column, indexName } of UNIQUE_COLUMNS) {
    if (!(await tableExists(queryInterface, table))) continue;

    const [rows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS n FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      { replacements: [table, indexName] },
    );

    if (Number(rows[0].n) > 0) {
      await queryInterface.removeIndex(table, indexName);
    }
  }
}
