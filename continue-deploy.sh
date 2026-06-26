#!/bin/bash
set -euo pipefail
APP_DIR="$HOME/velocesport"
MARIADB_DIR="$HOME/mariadb-local"
MARIADB_SOCKET="$HOME/mariadb/mysql.sock"
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm use 20

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
source "$APP_DIR/.env.production"
set +a

"$MARIADB_DIR/bin/mysql" --socket="$MARIADB_SOCKET" -uroot -e "
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
"

cat >"$APP_DIR/.env.native" <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=${JWT_ACCESS_EXPIRES_IN}
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN}
SESSION_INACTIVITY_TIMEOUT=${SESSION_INACTIVITY_TIMEOUT}
CORS_ORIGINS=${CORS_ORIGINS}
RATE_LIMIT_WINDOW_MS=${RATE_LIMIT_WINDOW_MS}
RATE_LIMIT_MAX=${RATE_LIMIT_MAX}
AUTH_LOGIN_RATE_LIMIT_WINDOW_MS=${AUTH_LOGIN_RATE_LIMIT_WINDOW_MS}
AUTH_LOGIN_RATE_LIMIT_MAX=${AUTH_LOGIN_RATE_LIMIT_MAX}
SUPER_ADMIN_PASSWORD=${SUPER_ADMIN_PASSWORD}
RUN_PRODUCTION_SEED=true
EOF

mkdir -p "$APP_DIR/apps/web"
cat >"$APP_DIR/apps/web/.env" <<EOF
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_ACCESS_EXPIRES_IN=${JWT_ACCESS_EXPIRES_IN}
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN}
PUBLIC_API_URL=${PUBLIC_API_URL}
INTERNAL_API_URL=http://127.0.0.1:3000
EOF

cd "$APP_DIR"
export CI=true
NODE_ENV=development pnpm install --frozen-lockfile
pnpm --filter @velocesport/shared build
pnpm --filter @velocesport/i18n build
pnpm --filter @velocesport/design-system build
ASTRO_BASE=/profe pnpm --filter @velocesport/web build
pnpm --filter @velocesport/backend build

cd "$APP_DIR/apps/backend"
set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.native"
set +a
node dist/scripts/run-migration.js
node dist/scripts/seed-production.js

pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "dist/server/entry.mjs" 2>/dev/null || true
sleep 2

mkdir -p "$APP_DIR/logs"
cd "$APP_DIR/apps/backend"
nohup node dist/index.js >"$APP_DIR/logs/backend.log" 2>&1 &
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
echo "Listo en /home"
