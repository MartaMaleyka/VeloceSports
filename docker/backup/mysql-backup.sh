#!/bin/bash
# Backup diario de MySQL: volcado consistente (--single-transaction) comprimido,
# con retención de BACKUP_RETENTION_DAYS días. Corre dentro del servicio `backup-mysql`.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}/mysql"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

mkdir -p "$BACKUP_DIR"

backup_once() {
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  target="$BACKUP_DIR/${DB_NAME}-${stamp}.sql.gz"
  tmp="$target.partial"

  echo "[backup-mysql] Volcando ${DB_NAME} → $target"
  if MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -h "${DB_HOST:-mysql}" -uroot \
      --single-transaction --quick --routines --triggers --no-tablespaces \
      --set-gtid-purged=OFF "$DB_NAME" | gzip -9 > "$tmp"; then
    # Solo se publica si el volcado está completo: gzip íntegro y la marca final de mysqldump.
    if gzip -t "$tmp" && gzip -dc "$tmp" | tail -n 1 | grep -q -- '-- Dump completed'; then
      mv "$tmp" "$target"
      echo "[backup-mysql] OK ($(du -h "$target" | cut -f1))"
    else
      rm -f "$tmp"
      echo "[backup-mysql] ERROR: volcado incompleto, descartado" >&2
      return 1
    fi
  else
    rm -f "$tmp"
    echo "[backup-mysql] ERROR: el volcado falló" >&2
    return 1
  fi

  find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -print -delete |
    sed 's/^/[backup-mysql] Eliminado por retención: /'
}

if [ "${1:-}" = "--once" ]; then
  backup_once
  exit $?
fi

while true; do
  backup_once || true
  sleep "$INTERVAL_SECONDS"
done
