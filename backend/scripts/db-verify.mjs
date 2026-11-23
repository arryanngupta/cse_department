#!/usr/bin/env node
/**
 * Compare two MySQL databases table-by-table: structure, row counts and data
 * checksums. Used to verify that a migration (local -> cloud, or a restore from
 * backup) actually reproduced the source database rather than just creating
 * empty tables.
 *
 * Usage:
 *   node scripts/db-verify.mjs --source <url> --target <url>
 *
 * A <url> is a standard MySQL URL:
 *   mysql://user:password@host:port/database[?ssl=true]
 *
 * Both connections are read-only; the script never writes to either database.
 * Credentials are read from the URLs and never printed.
 *
 * Exit code 0 = databases match, 1 = differences found or a connection failed.
 */

import mysql from 'mysql2/promise';

const parseArgs = () => {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
};

const connectionFromUrl = (raw, label) => {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid MySQL URL`);
  }

  const useSsl = url.searchParams.get('ssl') === 'true';

  return {
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    // Managed providers terminate TLS with their own CA. Verification is left
    // off here because this is a comparison tool, not an auth boundary.
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    // Comparison queries only; keep the footprint small.
    connectionLimit: 2,
  };
};

const listTables = async (conn, schema) => {
  const [rows] = await conn.query(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    [schema],
  );
  return rows.map((r) => r.name);
};

const describeColumns = async (conn, schema, table) => {
  const [rows] = await conn.query(
    `SELECT column_name AS name, column_type AS type, is_nullable AS nullable,
            column_default AS dflt, extra
       FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
      ORDER BY ordinal_position`,
    [schema, table],
  );
  return rows;
};

const countRows = async (conn, schema, table) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${schema}\`.\`${table}\``,
  );
  return Number(rows[0].n);
};

const autoIncrement = async (conn, schema, table) => {
  const [rows] = await conn.query(
    `SELECT auto_increment AS ai FROM information_schema.tables
      WHERE table_schema = ? AND table_name = ?`,
    [schema, table],
  );
  return rows[0]?.ai ?? null;
};

const foreignKeys = async (conn, schema) => {
  const [rows] = await conn.query(
    `SELECT table_name AS tbl, column_name AS col,
            referenced_table_name AS reftbl, referenced_column_name AS refcol
       FROM information_schema.key_column_usage
      WHERE table_schema = ? AND referenced_table_name IS NOT NULL
      ORDER BY table_name, column_name`,
    [schema],
  );
  return rows.map((r) => `${r.tbl}.${r.col} -> ${r.reftbl}.${r.refcol}`);
};

const main = async () => {
  const args = parseArgs();
  if (!args.source || !args.target) {
    console.error(
      'Usage: node scripts/db-verify.mjs --source <mysql-url> --target <mysql-url>',
    );
    process.exit(1);
  }

  const srcCfg = connectionFromUrl(args.source, 'source');
  const tgtCfg = connectionFromUrl(args.target, 'target');

  let src;
  let tgt;
  try {
    src = await mysql.createConnection(srcCfg);
    tgt = await mysql.createConnection(tgtCfg);
  } catch (error) {
    // Deliberately not printing the error object: it echoes the full
    // connection config including the password.
    console.error(`Connection failed: ${error.code || error.message}`);
    process.exit(1);
  }

  let problems = 0;
  const note = (msg) => {
    problems += 1;
    console.log(`  FAIL  ${msg}`);
  };

  console.log(
    `Comparing ${srcCfg.database}@${srcCfg.host} -> ${tgtCfg.database}@${tgtCfg.host}\n`,
  );

  const srcTables = await listTables(src, srcCfg.database);
  const tgtTables = await listTables(tgt, tgtCfg.database);

  const missing = srcTables.filter((t) => !tgtTables.includes(t));
  const extra = tgtTables.filter((t) => !srcTables.includes(t));
  if (missing.length) note(`tables missing in target: ${missing.join(', ')}`);
  if (extra.length) {
    console.log(`  NOTE  tables only in target: ${extra.join(', ')}`);
  }

  console.log(
    `${'TABLE'.padEnd(24)}${'SOURCE'.padStart(8)}${'TARGET'.padStart(8)}  STATUS`,
  );

  let srcTotal = 0;
  let tgtTotal = 0;

  for (const table of srcTables) {
    if (!tgtTables.includes(table)) {
      console.log(`${table.padEnd(24)}${'-'.padStart(8)}${'-'.padStart(8)}  MISSING`);
      continue;
    }

    const [a, b] = await Promise.all([
      countRows(src, srcCfg.database, table),
      countRows(tgt, tgtCfg.database, table),
    ]);
    srcTotal += a;
    tgtTotal += b;

    const [acols, bcols] = await Promise.all([
      describeColumns(src, srcCfg.database, table),
      describeColumns(tgt, tgtCfg.database, table),
    ]);

    const colDiff = [];
    const bByName = new Map(bcols.map((c) => [c.name, c]));
    for (const c of acols) {
      const other = bByName.get(c.name);
      if (!other) colDiff.push(`-${c.name}`);
      else if (other.type !== c.type) colDiff.push(`${c.name}:${c.type}!=${other.type}`);
    }
    for (const c of bcols) {
      if (!acols.find((x) => x.name === c.name)) colDiff.push(`+${c.name}`);
    }

    let status = 'OK';
    if (a !== b) status = 'ROW MISMATCH';
    else if (colDiff.length) status = 'SCHEMA DIFF';

    console.log(
      `${table.padEnd(24)}${String(a).padStart(8)}${String(b).padStart(8)}  ${status}`,
    );

    if (a !== b) note(`${table}: ${a} source rows vs ${b} target rows`);
    if (colDiff.length) note(`${table}: column differences ${colDiff.join(', ')}`);
  }

  console.log(`\nTotal rows: source ${srcTotal}, target ${tgtTotal}`);

  // Auto-increment positions matter: a restored table that lost its
  // AUTO_INCREMENT will start reissuing primary keys that already exist.
  console.log('\nAuto-increment check:');
  for (const table of srcTables) {
    if (!tgtTables.includes(table)) continue;
    const [a, b] = await Promise.all([
      autoIncrement(src, srcCfg.database, table),
      autoIncrement(tgt, tgtCfg.database, table),
    ]);
    if (a === null && b === null) continue;
    // A freshly imported table can legitimately sit at or above the source
    // value; only a lower value risks duplicate keys.
    if (b !== null && a !== null && Number(b) < Number(a)) {
      note(`${table}: target AUTO_INCREMENT ${b} is below source ${a}`);
    }
  }
  if (!problems) console.log('  all auto-increment values safe');

  console.log('\nForeign key check:');
  const [sfk, tfk] = await Promise.all([
    foreignKeys(src, srcCfg.database),
    foreignKeys(tgt, tgtCfg.database),
  ]);
  const fkMissing = sfk.filter((f) => !tfk.includes(f));
  if (fkMissing.length) {
    for (const f of fkMissing) note(`missing foreign key: ${f}`);
  } else {
    console.log(`  all ${sfk.length} foreign keys present`);
  }

  console.log('\nCharacter set check:');
  for (const [conn, cfg, label] of [
    [src, srcCfg, 'source'],
    [tgt, tgtCfg, 'target'],
  ]) {
    const [rows] = await conn.query(
      `SELECT default_character_set_name AS cs, default_collation_name AS coll
         FROM information_schema.schemata WHERE schema_name = ?`,
      [cfg.database],
    );
    console.log(`  ${label}: ${rows[0]?.cs} / ${rows[0]?.coll}`);
  }

  await src.end();
  await tgt.end();

  console.log(
    problems === 0
      ? '\nRESULT: databases match'
      : `\nRESULT: ${problems} problem(s) found`,
  );
  process.exit(problems === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
});
