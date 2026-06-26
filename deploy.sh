#!/bin/bash
set -euo pipefail
cd .
ln -sf .env.production .env
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
echo App: https://aby.litomalone.dev/profe/login
