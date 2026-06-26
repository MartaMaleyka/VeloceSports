#!/bin/sh
set -e

cd /app/apps/backend

echo ">> Aplicando migraciones..."
pnpm exec tsx src/scripts/run-migration.ts

if [ "${RUN_PRODUCTION_SEED}" = "true" ]; then
  echo ">> Seed de producción (super_admin)..."
  pnpm exec tsx src/scripts/seed-production.ts
fi

echo ">> Iniciando API..."
exec pnpm exec tsx src/index.ts
