#!/bin/sh
set -e

cd /app/apps/backend

echo ">> Aplicando migraciones..."
node dist/scripts/run-migration.js

if [ "${RUN_PRODUCTION_SEED}" = "true" ]; then
  echo ">> Seed de producción (super_admin)..."
  node dist/scripts/seed-production.js
fi

echo ">> Iniciando API..."
exec node dist/index.js
