#!/bin/bash
# Deploy nativo en /home (sin Docker) — puerto web 9082 para nginx /profe
set -euo pipefail

APP_DIR="$HOME/velocesport"
MARIADB_DIR="$HOME/mariadb-local"
MARIADB_DATA="$HOME/mariadb-data"
MARIADB_VERSION="10.11.13"
MARIADB_PORT="3307"
MARIADB_SOCKET="$HOME/mariadb/mysql.sock"
LOG_DIR="$HOME/velocesport/logs"
PID_DIR="$HOME/velocesport/run"

mkdir -p "$LOG_DIR" "$PID_DIR" "$MARIADB_DATA"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# --- Node via nvm ---
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  log "Instalando nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
if ! nvm ls 20 >/dev/null 2>&1; then
  log "Instalando Node 20..."
  nvm install 20
fi
nvm use 20
corepack enable
corepack prepare pnpm@9.15.0 --activate

# --- MariaDB portable en /home ---
if [ ! -x "$MARIADB_DIR/bin/mysqld" ]; then
  log "Descargando MariaDB $MARIADB_VERSION en $HOME ..."
  cd "$HOME"
  curl -fL -o mariadb.tar.gz \
    "https://downloads.mariadb.com/MariaDB/mariadb-${MARIADB_VERSION}/bintar-linux-systemd-x86_64/mariadb-${MARIADB_VERSION}-linux-systemd-x86_64.tar.gz"
  tar -xzf mariadb.tar.gz
  rm -f mariadb.tar.gz
  ln -sfn "mariadb-${MARIADB_VERSION}-linux-systemd-x86_64" "$MARIADB_DIR"
fi

export PATH="$MARIADB_DIR/bin:$PATH"
mkdir -p "$HOME/mariadb" "$MARIADB_DATA"

if [ ! -d "$MARIADB_DATA/mysql" ]; then
  log "Inicializando base de datos en $MARIADB_DATA ..."
  mariadb-install-db --datadir="$MARIADB_DATA" --auth-root-authentication-method=normal --skip-test-db
fi

if ! pgrep -f "mysqld.*$MARIADB_DATA" >/dev/null 2>&1; then
  log "Iniciando MariaDB en puerto $MARIADB_PORT ..."
  nohup mysqld \
    --datadir="$MARIADB_DATA" \
    --port="$MARIADB_PORT" \
    --socket="$MARIADB_SOCKET" \
    --bind-address=127.0.0.1 \
    --innodb-buffer-pool-size=256M \
    >"$LOG_DIR/mariadb.log" 2>&1 &
  echo $! >"$PID_DIR/mariadb.pid"
  sleep 5
fi

# Cargar secretos
set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.production"
set +a

log "Creando base de datos y usuario..."
mysql --socket="$MARIADB_SOCKET" -uroot -e "
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
"

# Env nativo para backend/web
cat >"$APP_DIR/.env.native" <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=${MARIADB_PORT}
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
RUN_PRODUCTION_SEED=${RUN_PRODUCTION_SEED:-true}
EOF

cat >"$APP_DIR/apps/web/.env" <<EOF
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_ACCESS_EXPIRES_IN=${JWT_ACCESS_EXPIRES_IN}
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN}
PUBLIC_API_URL=${PUBLIC_API_URL}
INTERNAL_API_URL=http://127.0.0.1:3000
EOF

log "Instalando dependencias y compilando..."
cd "$APP_DIR"
pnpm install --frozen-lockfile
pnpm --filter @velocesport/shared build
pnpm --filter @velocesport/i18n build
pnpm --filter @velocesport/design-system build
ASTRO_BASE=/profe pnpm --filter @velocesport/web build
pnpm --filter @velocesport/backend build

log "Migraciones y seed super_admin..."
cd "$APP_DIR/apps/backend"
set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.native"
set +a
node dist/scripts/run-migration.js
if [ "${RUN_PRODUCTION_SEED}" = "true" ]; then
  node dist/scripts/seed-production.js
  sed -i 's/^RUN_PRODUCTION_SEED=true/RUN_PRODUCTION_SEED=false/' "$APP_DIR/.env.production" 2>/dev/null || true
fi

# Detener procesos previos
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "dist/server/entry.mjs" 2>/dev/null || true
sleep 2

log "Iniciando backend (3000) y web (9082)..."
cd "$APP_DIR/apps/backend"
set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.native"
set +a
nohup node dist/index.js >"$LOG_DIR/backend.log" 2>&1 &
echo $! >"$PID_DIR/backend.pid"

cd "$APP_DIR/apps/web"
nohup env HOST=127.0.0.1 PORT=9082 ASTRO_BASE=/profe \
  JWT_ACCESS_SECRET="$JWT_ACCESS_SECRET" \
  JWT_ACCESS_EXPIRES_IN="$JWT_ACCESS_EXPIRES_IN" \
  JWT_REFRESH_EXPIRES_IN="$JWT_REFRESH_EXPIRES_IN" \
  INTERNAL_API_URL=http://127.0.0.1:3000 \
  node ./dist/server/entry.mjs >"$LOG_DIR/web.log" 2>&1 &
echo $! >"$PID_DIR/web.pid"

sleep 4
log "Verificando..."
curl -s -o /dev/null -w "backend: %{http_code}\n" http://127.0.0.1:3000/health || true
curl -s -o /dev/null -w "web 9082: %{http_code}\n" http://127.0.0.1:9082/profe/ || true
log "Listo. Logs en $LOG_DIR"
df -h /home
