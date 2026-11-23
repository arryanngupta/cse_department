import { sequelize } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '../src/db/migrations');
const seedersDir = path.join(__dirname, '../src/db/seeders');

const META_TABLE = 'SequelizeMeta';

/**
 * Create the tracking table if it does not exist.
 *
 * Without this the runner replayed every migration on every invocation, which
 * forced each altering migration to guard itself against double-application
 * and made `npm run migrate` progressively riskier as the list grew.
 */
const ensureMetaTable = async () => {
  await sequelize.getQueryInterface().sequelize.query(
    `CREATE TABLE IF NOT EXISTS \`${META_TABLE}\` (
       \`name\` VARCHAR(255) NOT NULL,
       \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (\`name\`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
};

const appliedMigrations = async () => {
  const [rows] = await sequelize.query(`SELECT name FROM \`${META_TABLE}\``);
  return new Set(rows.map((r) => r.name));
};

const markApplied = (name) =>
  sequelize.query(`INSERT IGNORE INTO \`${META_TABLE}\` (name) VALUES (?)`, {
    replacements: [name],
  });

const markReverted = (name) =>
  sequelize.query(`DELETE FROM \`${META_TABLE}\` WHERE name = ?`, {
    replacements: [name],
  });

/**
 * Adopt a database that predates the tracking table.
 *
 * The schema already exists, so re-running every migration would fail or
 * duplicate work. Instead the existing files are recorded as applied without
 * executing them — the schema is treated as the source of truth.
 */
const baselineExistingSchema = async (files) => {
  const [tables] = await sequelize.query('SHOW TABLES');
  const tableCount = tables.filter(
    (row) => Object.values(row)[0] !== META_TABLE,
  ).length;

  if (tableCount === 0) return false; // Fresh database: run normally.

  console.log(
    `\n📋 Found ${tableCount} existing tables and an empty ${META_TABLE}.\n` +
      '   Baselining: recording current migrations as already applied.\n' +
      '   (The existing schema is treated as correct and is not re-run.)\n',
  );

  for (const file of files) {
    await markApplied(file);
    console.log(`   ✓ ${file}`);
  }

  console.log('\n✅ Baseline complete. Future migrations will run once each.\n');
  return true;
};

const runMigrations = async (direction = 'up') => {
  try {
    await ensureMetaTable();

    const files = fs.readdirSync(migrationsDir).sort().filter((f) => f.endsWith('.js'));
    let applied = await appliedMigrations();

    // One-time adoption for databases created before tracking existed.
    if (direction === 'up' && applied.size === 0) {
      if (await baselineExistingSchema(files)) return;
      applied = await appliedMigrations();
    }

    console.log(`\n🚀 Running migrations: ${direction.toUpperCase()}\n`);

    // Reverting walks the list newest-first so dependent tables drop before
    // the tables they reference.
    const ordered = direction === 'up' ? files : [...files].reverse();
    let ran = 0;

    for (const file of ordered) {
      const isApplied = applied.has(file);

      if (direction === 'up' && isApplied) continue;
      if (direction === 'down' && !isApplied) continue;

      const moduleUrl = pathToFileURL(path.join(migrationsDir, file)).href;
      const migration = await import(moduleUrl);

      if (typeof migration[direction] !== 'function') {
        // 0003-create-programs.js is entirely commented out (superseded by
        // 0005-create-programs.js) and exports nothing.
        console.log(`⏭️  ${file} (no '${direction}' export, skipping)`);
        if (direction === 'up') await markApplied(file);
        continue;
      }

      console.log(`${direction === 'up' ? '⬆️' : '⬇️'}  ${file}`);
      await migration[direction](sequelize.getQueryInterface());

      if (direction === 'up') await markApplied(file);
      else await markReverted(file);
      ran += 1;
    }

    console.log(
      ran === 0
        ? '\n✅ Already up to date — nothing to apply.\n'
        : `\n✅ Migrations completed successfully (${ran} applied)\n`,
    );
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

const runSeeders = async () => {
  try {
    const files = fs.readdirSync(seedersDir).sort();

    console.log('\n🌱 Running seeders...\n');

    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(seedersDir, file);
        const moduleUrl = pathToFileURL(filePath).href;

        const seeder = await import(moduleUrl);

        console.log(`🌿 Seeding: ${file}`);
        await seeder.up(sequelize.getQueryInterface());
      }
    }

    console.log('\n✅ Seeders completed successfully\n');
  } catch (error) {
    console.error('\n❌ Seeder failed:', error);
    process.exit(1);
  }
};

const command = process.argv[2];

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    switch (command) {
      case 'up':
        await runMigrations('up');
        break;
      case 'down':
        await runMigrations('down');
        break;
      case 'seed':
        await runSeeders();
        break;
      case 'reset':
        console.log('\n♻️ Resetting database...\n');
        await runMigrations('down');
        await runMigrations('up');
        await runSeeders();
        console.log('\n🔄 Database reset completed\n');
        break;
      default:
        console.log('⚠️ Usage: node scripts/migrate.js [up|down|seed|reset]');
        process.exit(1);
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
})();
