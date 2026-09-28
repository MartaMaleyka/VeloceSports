#!/bin/sh
# Copia diaria del bucket de fotos a disco (`mc mirror`: incremental, conserva los
# objetos borrados en el origen hasta la siguiente limpieza manual). Servicio `backup-minio`.
set -eu

TARGET="${BACKUP_DIR:-/backups}/minio/${MINIO_BUCKET}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
MINIO_URL="${MINIO_URL:-http://minio:9000}"

mkdir -p "$TARGET"

until mc alias set src "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null; do
  echo "[backup-minio] Esperando a MinIO..."
  sleep 5
done

mirror_once() {
  echo "[backup-minio] Copiando src/${MINIO_BUCKET} → $TARGET"
  if mc mirror --overwrite --quiet "src/${MINIO_BUCKET}" "$TARGET"; then
    echo "[backup-minio] OK ($(find "$TARGET" -type f | wc -l) archivos)"
  else
    echo "[backup-minio] ERROR en la copia" >&2
    return 1
  fi
}

if [ "${1:-}" = "--once" ]; then
  mirror_once
  exit $?
fi

while true; do
  mirror_once || true
  sleep "$INTERVAL_SECONDS"
done
