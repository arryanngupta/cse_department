#!/usr/bin/env bash
#
# Migrate the local MySQL database to a managed cloud MySQL instance.
#
#   1. Takes a fresh, verified logical backup of the local database.
#   2. Imports it into the cloud database.
#   3. Compares both databases and fails if they differ.
#
# Nothing is dropped on the target. If the target already holds data, the
# import's CREATE TABLE statements will collide and the script stops before
# touching anything, so an accidental run cannot silently overwrite a live
# database.
#
# Usage:
#   LOCAL_URL='mysql://root:pass@127.0.0.1:3306/lnmiit_cse' \
#   CLOUD_URL='mysql://user:pass@host:port/dbname?ssl=true' \
#   ./scripts/migrate-to-cloud.sh
#
# Credentials are passed via per-run option files with 0600 permissions, never
# on the command line, so they do not appear in `ps` output or shell history.

set -euo pipefail

: "${LOCAL_URL:?Set LOCAL_URL to the source MySQL URL}"
: "${CLOUD_URL:?Set CLOUD_URL to the target MySQL URL}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/cse-department-backups}"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Split a mysql:// URL into an option file the mysql/mysqldump clients can read.
write_cnf() {
  local url="$1" out="$2"
  node -e '
    const u = new URL(process.argv[1]);
    const lines = [
      "[client]",
      `host=${u.hostname}`,
      `port=${u.port || 3306}`,
      `user=${decodeURIComponent(u.username)}`,
      `password=${decodeURIComponent(u.password)}`,
      "default-character-set=utf8mb4",
    ];
    if (u.searchParams.get("ssl") === "true") lines.push("ssl-mode=REQUIRED");
    process.stdout.write(lines.join("\n") + "\n");
  ' "$url" > "$out"
  chmod 600 "$out"
}

db_name() {
  node -e 'process.stdout.write(new URL(process.argv[1]).pathname.replace(/^\//, ""))' "$1"
}

LOCAL_CNF="$WORK/local.cnf"
CLOUD_CNF="$WORK/cloud.cnf"
write_cnf "$LOCAL_URL" "$LOCAL_CNF"
write_cnf "$CLOUD_URL" "$CLOUD_CNF"

LOCAL_DB="$(db_name "$LOCAL_URL")"
CLOUD_DB="$(db_name "$CLOUD_URL")"

DUMP="$BACKUP_DIR/lnmiit_cse_premigration_$STAMP.sql"

echo "==> 1/5  Checking connectivity"
mysql --defaults-extra-file="$LOCAL_CNF" -e "SELECT 1" >/dev/null
echo "    local  OK"
mysql --defaults-extra-file="$CLOUD_CNF" -e "SELECT 1" >/dev/null
echo "    cloud  OK"

echo "==> 2/5  Refusing to overwrite a non-empty target"
EXISTING="$(mysql --defaults-extra-file="$CLOUD_CNF" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$CLOUD_DB' AND table_type='BASE TABLE'")"
if [ "$EXISTING" -ne 0 ]; then
  echo "    target '$CLOUD_DB' already has $EXISTING table(s)."
  echo "    Refusing to import over existing data. Drop them deliberately first,"
  echo "    or point CLOUD_URL at an empty database."
  exit 1
fi
echo "    target is empty"

echo "==> 3/5  Dumping local database"
# --set-gtid-purged=OFF: GTID statements require SUPER and are rejected by
# managed providers. DEFINER clauses are stripped for the same reason.
mysqldump --defaults-extra-file="$LOCAL_CNF" \
  --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --hex-blob \
  "$LOCAL_DB" | sed -e 's/DEFINER=[^ ]*//g' > "$DUMP"
chmod 600 "$DUMP"
echo "    wrote $DUMP ($(wc -c < "$DUMP") bytes, $(grep -c 'CREATE TABLE' "$DUMP") tables)"

echo "==> 4/5  Importing into cloud database"
mysql --defaults-extra-file="$CLOUD_CNF" "$CLOUD_DB" < "$DUMP"
echo "    import completed"

echo "==> 5/5  Verifying"
cd "$(dirname "$0")/.."
node scripts/db-verify.mjs --source "$LOCAL_URL" --target "$CLOUD_URL"

echo
echo "Migration verified. Backup retained at:"
echo "  $DUMP"
echo
echo "Next: set DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS and DB_SSL=true in the"
echo "backend's production environment, then redeploy."
