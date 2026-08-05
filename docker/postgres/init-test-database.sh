#!/bin/sh
set -eu

test_database="${POSTGRES_TEST_DB:-life_dashboard_test}"

case "$test_database" in
  *[!a-zA-Z0-9_]*)
    echo "POSTGRES_TEST_DB contains unsupported characters" >&2
    exit 1
    ;;
esac

database_exists="$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align \
  --command "SELECT 1 FROM pg_database WHERE datname = '$test_database'")"

if [ "$database_exists" != "1" ]; then
  createdb --username "$POSTGRES_USER" --owner "$POSTGRES_USER" "$test_database"
fi
