#!/bin/bash
set -euo pipefail
cd .
ln -sf .env.production .env
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
echo "App: $(grep -E '^PUBLIC_SITE_URL=' .env.production | cut -d= -f2-)${ASTRO_BASE:-/profe}/login"
