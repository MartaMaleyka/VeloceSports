# SquadVeloce

Plataforma SaaS multi-tenant para academias de fútbol formativo: gestión de
jugadores, categorías y partidos, captura de acciones en vivo desde la cancha,
reportes por jugador y portal para padres y jugadores.

## Arquitectura

```
Navegador ──► apps/web (Astro SSR + islands React)  ──►  apps/backend (Express + MySQL)
                 │  BFF: /api/*                              │
                 │  cookies httpOnly con los JWT             ├─► MySQL 8
                 │  CSRF: security.checkOrigin               ├─► MinIO (fotos, URLs firmadas)
                 │                                           └─► Ollama (insights IA, opcional)
```

- **El navegador nunca llama al backend directamente.** Las rutas `apps/web/src/pages/api/*`
  actúan como BFF: leen los tokens de cookies httpOnly, renuevan la sesión y reenvían la
  petición al backend (`INTERNAL_API_URL`).
- **Multi-tenant:** el `tenant_id` se deriva siempre del JWT (middleware `tenant`), nunca
  del body ni de la query.
- **Roles:** `super_admin`, `academy_admin`, `coach`, `parent`, `player`. Un usuario puede
  tener varios roles (`user_roles`).

| Ruta | Contenido |
|---|---|
| `apps/backend` | API Express: `routes → controllers → services → repositories`, validación con Zod, migraciones SQL en `db/migrations`, tests con Jest + Supertest |
| `apps/web` | Astro SSR, páginas por rol en `src/pages/dashboard`, BFF en `src/pages/api` |
| `packages/shared` | Tipos, DTOs y reglas de negocio compartidas (front y back) |
| `packages/i18n` | Traducciones es/en tipadas + validador de claves |
| `packages/design-system` | Componentes React, tokens y preset de Tailwind |
| `docker/` | Dockerfiles, entrypoints y scripts de despliegue |
| `docs/` | `dominio.md` (entidades y reglas), requerimientos funcionales, guía de Cursor |

## Desarrollo local

Requisitos: Node 20+, pnpm 9 (`corepack enable`) y Docker.

```bash
pnpm install                                   # compila también shared, i18n y design-system

# MySQL (3307) + MinIO (9100/9101), solo en localhost
cp .env.minio.example .env.minio
docker compose --env-file .env.minio up -d

# Backend
cp apps/backend/.env.example apps/backend/.env # ajustar DB_* (puerto 3307 con el compose)
pnpm --filter @velocesport/backend db:migrate
pnpm db:seed                                   # datos demo; imprime usuarios y contraseña
pnpm dev:backend                               # http://localhost:3000 — Swagger en /api/docs

# Web
cp apps/web/.env.example apps/web/.env         # JWT_ACCESS_SECRET igual que en el backend
pnpm dev:web                                   # http://localhost:8065
```

- **Fotos (MinIO):** el servicio `minio-init` crea el bucket privado `squadveloce-players`.
  Consola en <http://localhost:9101>. El backend solo entrega URLs firmadas.
- **Insights IA (opcional):** con `OLLAMA_ENABLED=true` y `ollama pull llama3.2:3b`. Sin
  Ollama, el análisis usa un texto de respaldo determinístico.

## Tests

```bash
pnpm --filter @velocesport/backend test   # necesita MySQL y apps/backend/.env.test
pnpm --filter @velocesport/web test       # vitest
pnpm --filter @velocesport/i18n test      # claves es/en sincronizadas
```

`apps/backend/.env.test` es como `.env.example` pero con `NODE_ENV=test`, una base de datos
propia (los tests la vacían) y límites de login altos (`AUTH_LOGIN_RATE_LIMIT_MAX=10000`),
porque las suites inician sesión muchas veces seguidas. El workflow
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) ejecuta todo esto en cada PR.

## Despliegue (Docker)

```bash
cp .env.production.example .env.production   # completar secretos y dominio
./deploy.sh                                  # docker compose -f docker-compose.prod.yml up -d --build
```

- `RUN_PRODUCTION_SEED=true` solo en el primer despliegue (crea el `super_admin`); después, `false`.
- La web escucha en `127.0.0.1:9082`: debe quedar detrás de un proxy (nginx) que termine TLS,
  añada HSTS y envíe `X-Forwarded-For`.
- `ASTRO_SITE` / `ASTRO_ALLOWED_ORIGINS` deben coincidir con el origen público, porque
  `checkOrigin` (protección CSRF) compara el `Origin` del navegador. **No** desactivar `checkOrigin`.
- Si el backend corre en Docker y MinIO en el host: `MINIO_ENDPOINT=host.docker.internal`
  (API interna) y `MINIO_PUBLIC_ENDPOINT`/`MINIO_PUBLIC_PORT` para las URLs que ve el navegador.
- Ollama: tras el primer arranque, `docker exec velocesport-ollama ollama pull llama3.2:3b`.

Variables principales (ver los `.env*.example` para la lista completa):

| Variable | Dónde | Para qué |
|---|---|---|
| `NODE_ENV` | backend | `production` en despliegues |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | backend (+ access en web) | Firma de tokens (≥ 32 caracteres) |
| `CORS_ORIGINS` | backend | Orígenes permitidos |
| `PUBLIC_SITE_URL`, `ASTRO_SITE`, `ASTRO_ALLOWED_ORIGINS` | web | Origen público y CSRF |
| `INTERNAL_API_URL` | web | URL del backend dentro de la red |
| `MINIO_*` | backend | Almacenamiento de fotos |
| `OLLAMA_*` | backend | Agente de insights |

## Backups y tareas programadas

**Backups** (servicios `backup-mysql` y `backup-minio` de `docker-compose.prod.yml`, activos por defecto):

- MySQL: `mysqldump --single-transaction` comprimido cada 24 h en `${BACKUP_DIR:-./backups}/mysql`,
  con retención de `BACKUP_RETENTION_DAYS` (14). Un volcado incompleto se descarta: nunca queda
  un backup vacío con apariencia de válido.
- Fotos: `mc mirror` incremental del bucket a `${BACKUP_DIR}/minio/<bucket>`.
- Los archivos quedan en el mismo servidor: **cópialos también fuera** (rsync, S3, etc.).

Backup manual y restauración:

```bash
docker compose -f docker-compose.prod.yml run --rm backup-mysql --once
gunzip -c backups/mysql/<DB_NAME>-<fecha>.sql.gz \
  | docker exec -i velocesport-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
docker exec velocesport-backup-minio mc mirror --overwrite /backups/minio/<bucket> src/<bucket>
```

**Facturas vencidas:** con `BILLING_OVERDUE_JOB_ENABLED=true`, el backend marca cada día
(a `BILLING_OVERDUE_JOB_HOUR_UTC`, 6:00 UTC por defecto) las facturas vencidas y **suspende las
academias afectadas**. Está desactivado por defecto porque es una decisión de negocio; con varias
réplicas solo una lo ejecuta (lock de MySQL). Ejecución manual: `pnpm --filter @velocesport/backend billing:process-overdue`.

## Documentación

- [`docs/dominio.md`](docs/dominio.md): entidades, módulos y reglas de negocio.
- `docs/Requerimientos_Funcionales_Academia_Futbol_SaaS_v2.docx`: fuente de verdad funcional.
- [`docs/cursor.md`](docs/cursor.md): cómo están organizadas las reglas de `.cursor/rules`.
