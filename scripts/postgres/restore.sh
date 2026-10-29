#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
archive_path="${1:?Backup archive path is required}"

pg_restore --list "$archive_path" >/dev/null
pg_restore --single-transaction --exit-on-error --clean --if-exists --no-owner --no-privileges \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$archive_path"
