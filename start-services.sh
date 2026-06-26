#!/bin/bash
set -euo pipefail
APP_DIR="$HOME/velocesport"
MARIADB_DIR="$HOME/mariadb-local"
MARIADB_SOCKET="$HOME/mariadb/mysql.sock"
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm use 20
export CI=true

if ! pgrep -f "mysqld.*mariadb-data" >/dev/null; then
  export LD_LIBRARY_PATH="$MARIADB_DIR/lib:${LD_LIBRARY_PATH:-}"
  nohup "$MARIADB_DIR/bin/mysqld" --no-defaults \
    --datadir="$HOME/mariadb-data" --port=3307 \
    --socket="$MARIADB_SOCKET" --bind-address=127.0.0.1 \
    --innodb-buffer-pool-size=256M >>"$APP_DIR/logs/mariadb.log" 2>&1 &
  sleep 4
fi

set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.native"
set +a
cp "$APP_DIR/.env.native" "$APP_DIR/apps/backend/.env"

cd "$APP_DIR/apps/backend"
pnpm exec tsx src/scripts/run-migration.ts
pnpm exec tsx src/scripts/seed-production.ts

pkill -f "src/index.ts" 2>/dev/null || true
pkill -f "dist/index.js" 2>/dev/null || true
pkill -f "dist/server/entry.mjs" 2>/dev/null || true
sleep 2

cd "$APP_DIR/apps/backend"
nohup pnpm exec tsx src/index.ts >"$APP_DIR/logs/backend.log" 2>&1 &

cd "$APP_DIR/apps/web"
nohup env HOST=127.0.0.1 PORT=9082 ASTRO_BASE=/profe \
  JWT_ACCESS_SECRET="$JWT_ACCESS_SECRET" \
  JWT_ACCESS_EXPIRES_IN="$JWT_ACCESS_EXPIRES_IN" \
  JWT_REFRESH_EXPIRES_IN="$JWT_REFRESH_EXPIRES_IN" \
  INTERNAL_API_URL=http://127.0.0.1:3000 \
  node ./dist/server/entry.mjs >"$APP_DIR/logs/web.log" 2>&1 &
sleep 6
curl -s -o /dev/null -w "backend:%{http_code} " http://127.0.0.1:3000/health
curl -s -o /dev/null -w "web:%{http_code}\n" http://127.0.0.1:9082/profe/
echo "Listo en /home - puerto 9082"
