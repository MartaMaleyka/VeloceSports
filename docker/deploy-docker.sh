#!/bin/bash
# Limpia deploy nativo en /home y levanta Docker en puerto 9082
set -euo pipefail

echo "==> Deteniendo servicios nativos..."
pkill -f "tsx src/index.ts" 2>/dev/null || true
pkill -f "dist/server/entry.mjs" 2>/dev/null || true
pkill -f "mysqld.*mariadb-data" 2>/dev/null || true
sleep 2

echo "==> Borrando MariaDB nativo de /home..."
rm -rf "$HOME/mariadb" "$HOME/mariadb-data" "$HOME/mariadb-local" \
       "$HOME/mariadb-10.11.13-linux-systemd-x86_64" "$HOME/mariadb.tar.gz" 2>/dev/null || true

echo "==> Limpiando node_modules nativos (Docker reconstruye)..."
rm -rf "$HOME/velocesport/node_modules" \
       "$HOME/velocesport/apps/web/node_modules" \
       "$HOME/velocesport/apps/backend/node_modules" 2>/dev/null || true
find "$HOME/velocesport/packages" -maxdepth 2 -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true

cd "$HOME/velocesport"
ln -sf .env.production .env
sed -i '1s/^\xEF\xBB\xBF//' .env.production 2>/dev/null || true

echo "==> Docker compose down..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.production down --remove-orphans 2>/dev/null || true

echo "==> Docker compose up --build (web en 127.0.0.1:9082)..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --force-recreate

echo ""
echo "==> Contenedores:"
sudo docker compose -f docker-compose.prod.yml ps

echo ""
curl -s -o /dev/null -w "web 9082: %{http_code}\n" http://127.0.0.1:9082/profe/login || true
echo "App: https://aby.litomalone.dev/profe/login"
df -h /home
