# Database Migration

How to back up the local MySQL database, move it to a managed cloud instance,
verify the result, and roll back if something goes wrong.

---

## Current state

The original Aiven MySQL instance referenced in `backend/.env` was deleted after
being powered off past its end-of-life grace period; its hostname no longer
resolves. **The local MySQL database is the source of truth.**

As of 2026-11-23 the local database holds:

| | |
|---|---|
| Database | `lnmiit_cse` |
| Tables | 20 |
| Rows | 62 |
| Foreign keys | 6 |
| Character set | `utf8mb4` / `utf8mb4_0900_ai_ci` |

Row counts by table: `programs` 8, `curriculum_semesters` 8, `people` 7,
`research` 5, `achievements` 4, `sliders` 4, `directory_entries` 4,
`info_blocks` 4, `news` 3, `events` 3, `curriculum_courses` 3,
`program_sections` 3, `newsletters` 2, `program_outcomes` 2, `facilities` 1,
`users` 1, and four empty tables (`admins`, `directory`, `opportunity_blocks`,
`section_content`).

---

## 1. Back up the local database

Backups live **outside the repository**, in `~/cse-department-backups/` with
`0700` permissions. The repository's `.gitignore` also excludes `*.sql`, so a
dump accidentally left in the project root is still not committable.

Credentials are passed through a `0600` option file rather than on the command
line, so they never appear in `ps` output or shell history:

```bash
umask 077
cat > /tmp/my-local.cnf <<'EOF'
[client]
host=127.0.0.1
port=3306
user=root
password=YOUR_PASSWORD
default-character-set=utf8mb4
EOF

mkdir -p ~/cse-department-backups && chmod 700 ~/cse-department-backups

mysqldump --defaults-extra-file=/tmp/my-local.cnf \
  --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --hex-blob \
  --databases lnmiit_cse > ~/cse-department-backups/lnmiit_cse_full_$(date +%F).sql

chmod 600 ~/cse-department-backups/*.sql
rm /tmp/my-local.cnf
```

Flag notes, each of which matters:

- `--single-transaction` — consistent snapshot without locking the tables.
- `--routines --triggers --events` — stored programs, not just table data.
- **`--set-gtid-purged=OFF`** — without this the dump emits
  `SET @@GLOBAL.GTID_PURGED`, which requires `SUPER` and is **rejected by every
  managed provider**. This is the single most common cause of a failed cloud
  import.
- `--hex-blob` — binary columns survive the round trip.

### A backup you have not restored is not a backup

Always verify by restoring into a throwaway database and comparing:

```bash
mysql --defaults-extra-file=… -e "CREATE DATABASE restore_verify CHARACTER SET utf8mb4"
mysql --defaults-extra-file=… restore_verify < ~/cse-department-backups/lnmiit_cse_full_2026-11-23.sql

cd backend
node scripts/db-verify.mjs \
  --source 'mysql://root:PASSWORD@127.0.0.1:3306/lnmiit_cse' \
  --target 'mysql://root:PASSWORD@127.0.0.1:3306/restore_verify'

mysql --defaults-extra-file=… -e "DROP DATABASE restore_verify"
```

Percent-encode special characters in the password inside the URL (`@` → `%40`).

---

## 2. Choose a cloud provider

Keep **MySQL**. `backend/src/config/database.js` sets `dialect: 'mysql'` and the
dumps are MySQL syntax; PostgreSQL would require rewriting both.

Evaluated against the project's needs — small dataset (under 100 rows today),
read-heavy public traffic, India/Singapore latency, and the requirement that the
database **must not be auto-deleted when idle**, which is exactly what killed
the previous instance:

| Provider | Plan | ~Monthly | Backups | Idle deletion | Notes |
|---|---|---|---|---|---|
| **Aiven for MySQL** | Startup-1 | ~$30 | Daily + PITR | **Powered-off services are deleted after the grace period** | What was used before. Viable only if never powered off. |
| **DigitalOcean Managed MySQL** | 1 GB / 1 vCPU | ~$15 | Daily, 7-day PITR | No | Bangalore (BLR1) and Singapore regions. Good price/latency fit. |
| **AWS RDS MySQL** | db.t4g.micro | ~$15–20 | Automated, PITR | No | ap-south-1 (Mumbai). Most operational knobs. |
| **Railway MySQL** | Usage-based | ~$5–15 | Snapshot only | Trial plans sleep | Cheapest, weakest durability story. |
| PlanetScale | Scaler | ~$39 | Branch-based | No | No foreign keys by default — this schema has 6. |

**Recommendation: DigitalOcean Managed MySQL (Bangalore) or AWS RDS
(ap-south-1).** Both give daily backups plus point-in-time recovery, enforce
TLS, support private networking, and never delete an idle database.

Avoid free tiers that suspend or delete on inactivity — that failure mode is
precisely what this migration exists to recover from.

---

## 3. Provision

1. Create a MySQL **8.0 or 8.4** instance in `ap-south-1` / `BLR1`.
2. Create the database (`lnmiit_cse`) and an application user.
3. Grant that user only what it needs — **not** `SUPER`, **not** `GRANT OPTION`:
   ```sql
   CREATE USER 'lnmiit_app'@'%' IDENTIFIED BY 'strong-generated-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
     ON lnmiit_cse.* TO 'lnmiit_app'@'%';
   FLUSH PRIVILEGES;
   ```
   `CREATE/ALTER/INDEX/DROP` are needed because migrations run as this user. If
   you prefer, run migrations as an admin user and drop those from the runtime
   grant.
4. Restrict network access to Render's egress IPs (Render → Settings →
   Outbound IPs). Avoid `0.0.0.0/0`.
5. Confirm automated backups and point-in-time recovery are enabled.
6. Note the CA certificate if the provider publishes one — set it as
   `DB_SSL_CA` for full certificate verification rather than
   encryption-without-verification.

---

## 4. Migrate

`backend/scripts/migrate-to-cloud.sh` does backup → import → verify in one
command:

```bash
cd backend
LOCAL_URL='mysql://root:PASSWORD@127.0.0.1:3306/lnmiit_cse' \
CLOUD_URL='mysql://lnmiit_app:PASSWORD@host:25060/lnmiit_cse?ssl=true' \
./scripts/migrate-to-cloud.sh
```

It will:

1. Check connectivity to both databases.
2. **Refuse to run if the target already contains tables** — an accidental
   second run cannot overwrite live data.
3. Dump the local database (GTID statements off, `DEFINER` clauses stripped).
4. Import into the cloud database.
5. Run `db-verify.mjs` and exit non-zero on any mismatch.

The pre-migration dump is retained in `~/cse-department-backups/`.

### What verification actually checks

`scripts/db-verify.mjs` compares, and fails on any difference:

- Every source table exists in the target
- Row counts per table
- Column names and types per table
- `AUTO_INCREMENT` positions — a target value *below* the source would reissue
  primary keys that already exist
- All foreign key relationships
- Database character set and collation

Expected output:

```
Total rows: source 62, target 62
Auto-increment check:
  all auto-increment values safe
Foreign key check:
  all 6 foreign keys present
RESULT: databases match
```

### Also verify at the application layer

Schema parity is necessary but not sufficient:

```bash
# Point the backend at the cloud database, then:
npm run migrate           # idempotent; should apply only what is missing
BASE_URL=http://localhost:3022 npm test
```

Then confirm by hand: admin login works, faculty photos load from Cloudinary
(those are absolute URLs stored in the database, so they survive the move
unchanged), and search returns results.

---

## 5. Production configuration

Set in Render (never in the repository):

```
DB_HOST=<cloud host>
DB_PORT=<cloud port>
DB_NAME=lnmiit_cse
DB_USER=lnmiit_app
DB_PASS=<password>
DB_SSL=true
DB_SSL_CA=<PEM contents, optional but preferred>
NODE_ENV=production
```

`backend/src/config/database.js` enforces the important parts:

- TLS defaults **on** when `NODE_ENV=production`. Disabling it requires
  `DB_SSL=false` explicitly, so an unset variable cannot silently downgrade
  production to an unencrypted connection.
- Missing `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` is a **startup failure**.
  There are no in-source credential fallbacks — a fallback password in a
  tracked file is both a credential leak and a way for production to boot
  against the wrong database.
- Connection errors log the driver's error code only. The full Sequelize error
  object embeds the connection config including the password.
- SQL query logging is off in production regardless of `DB_LOGGING`.

Pool defaults to `max: 10` in production — conservative, because entry-tier
managed instances cap total connections (Aiven's smallest plans allow ~20) and
Render may run several instances against one database.

---

## 6. Schema changes

Use migrations. **Never `sequelize.sync({ alter: true })` or `{ force: true }`
in production** — `alter` silently drops columns it cannot reconcile and
`force` drops every table.

```bash
npm run migrate        # apply
npm run migrate:down   # revert
```

### How the runner tracks state

`scripts/migrate.js` records applied migrations in a **`SequelizeMeta`** table,
so each file runs exactly once. `npm run migrate` on an up-to-date database
reports `Already up to date — nothing to apply.`

**Adopting an existing database.** The first run against a database that
predates tracking detects the existing tables, records every current migration
as applied *without executing it*, and stops. The existing schema is treated as
the source of truth — re-running creation migrations over a populated database
would at best be noise and at worst destructive. A fresh database skips
baselining and applies everything normally.

`down` walks the list newest-first, so dependent tables drop before the tables
they reference.

The runner also skips files exporting no `up`/`down` function. That guard was
added because `0003-create-programs.js` was entirely commented out (superseded
by `0005-create-programs.js`) and crashed the whole run; that dead file has
since been deleted.

### Writing a migration

Plain `createTable` migrations need nothing special. Migrations that **alter**
an existing table should still check the current schema first:

```js
export async function up(queryInterface) {
  const table = await queryInterface.describeTable('users');
  if (table.must_change_password) return;   // already applied
  await queryInterface.addColumn('users', 'must_change_password', { … });
}
```

Tracking makes this unnecessary in normal operation, but it keeps the migration
safe if it is ever applied to a database that was partially modified by hand —
which is exactly the situation this project was recovering from.

### Never run `sync({ alter: true })`

The call in `src/index.js` is commented out and must stay that way. Past runs
left **32 duplicate UNIQUE indexes** across three tables (`users.email` ×11,
`info_blocks.key` ×11, `people.slug` ×10) because each run added another index
instead of recognising the existing one. Every write maintained all of them,
and MySQL caps a table at 64 indexes, so the next few runs would have started
failing `ALTER TABLE` outright.

Migrations `0024` and `0025` clean that up and restore the unique constraints.
Verify a database is healthy with:

```sql
SELECT table_name, column_name, COUNT(*) AS dupes
  FROM information_schema.statistics
 WHERE table_schema = DATABASE()
 GROUP BY table_name, column_name
HAVING dupes > 1;
```

A column appearing in both a single-column lookup index and a composite unique
key is expected (`research_authors.research_id` is in both); eleven indexes on
one column is not.

---

## 7. Rollback

### Application rollback (fastest)

Point `DB_HOST` and friends back at the previous database and redeploy. The
cloud instance is left untouched for inspection. This is the first move in
almost every incident.

### Restore from a dump

```bash
mysql --defaults-extra-file=/tmp/cloud.cnf \
  -e "DROP DATABASE lnmiit_cse; CREATE DATABASE lnmiit_cse CHARACTER SET utf8mb4"
mysql --defaults-extra-file=/tmp/cloud.cnf lnmiit_cse \
  < ~/cse-department-backups/lnmiit_cse_premigration_<timestamp>.sql
```

Then re-verify with `db-verify.mjs` before sending traffic back.

### Point-in-time recovery

For data corruption discovered late — a bad bulk edit, an accidental delete —
use the provider's PITR to restore to a timestamp just before the event. This
is the only mechanism that recovers data written *after* the last dump, which
is why PITR support was a selection criterion above.

---

## 8. Ongoing backups

The provider's automated backups are the primary mechanism. Keep an
independent logical dump as well, so recovery never depends on a single vendor:

```bash
# Suggested: nightly, retained 30 days, stored off-host
mysqldump --defaults-extra-file=/path/to/cloud.cnf \
  --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --hex-blob \
  --databases lnmiit_cse | gzip > "backup-$(date +%F).sql.gz"
```

Restore-test it on a schedule. An untested backup is a hypothesis.
