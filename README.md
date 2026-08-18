# Cómo darle contexto a Cursor (este paquete)

Cursor lee automáticamente los archivos `.mdc` dentro de `.cursor/rules/` en cada
prompt. Eso es mejor que pegar todo en el chat: el contexto persiste, se versiona en
Git y se aplica solo cuando corresponde (por `globs`).

## Estructura
```
.cursor/rules/
  000-proyecto.mdc        alwaysApply: true  → contexto global, stack, multi-tenant, roles
  100-backend.mdc         globs backend      → Express, MySQL, JWT, seguridad, Swagger, tests
  200-frontend.mdc        globs frontend     → Astro SSR, React 19, Tailwind, mobile-first, a11y
  300-design-system.mdc   globs design-sys   → 5 capas, tokens W3C de 3 niveles, governance
docs/
  dominio.md              entidades, módulos, reglas de negocio, orden de construcción
```

## Pasos para arrancar
1. Copia `.cursor/` y `docs/` a la raíz de tu repo (monorepo).
2. Copia también el documento original de requerimientos a `docs/` (la fuente de verdad).
3. Abre el repo en Cursor. La regla `000` se aplica siempre; las demás se activan al
   editar archivos de su carpeta.
4. Para tareas grandes, referencia explícitamente el dominio con `@docs/dominio.md` y
   el requerimiento concreto (p. ej. "implementa RF-CAP siguiendo @docs/dominio.md").

## Mecánica de los `.mdc` (por si quieres ajustarlos)
- `alwaysApply: true` → siempre en contexto (úsalo solo para lo esencial; ocupa tokens).
- `globs: ...` + `alwaysApply: false` → se incluye solo al tocar esos archivos.
- `description` → permite a Cursor traer la regla bajo demanda cuando es relevante.

## Primer prompt sugerido en Cursor
> Lee `.cursor/rules/000-proyecto.mdc` y `@docs/dominio.md`. Vamos a inicializar el
> monorepo con la estructura de `/apps` y `/packages` descrita. Empieza por:
> (1) scaffolding del backend Express con capas controller/service/repository,
> middlewares de `helmet`, `cors` (allowlist), `express-rate-limit`, el middleware
> `tenant` que deriva `tenantId` del JWT, y `errorHandler` centralizado;
> (2) configuración de Swagger en `/api/docs`;
> (3) un test de Supertest que verifique aislamiento multi-tenant (tenant A no lee
> datos de tenant B). No implementes módulos de negocio todavía.

## Por qué este enfoque (y no pegar el doc completo cada vez)
- El contexto vive en Git: todo el equipo y cada sesión de Cursor lo comparten.
- Se aplica selectivamente por carpeta → menos ruido, respuestas más precisas.
- Las reglas separan "qué construir" (dominio) de "cómo construirlo" (stack/seguridad/DS),
  que es justo lo que un modelo necesita para no improvisar.

---

## MinIO local (fotos de jugadores)

Solo para **desarrollo**. Las fotos viven en un bucket privado; el backend sirve URLs firmadas.

1. Copia credenciales:
   ```bash
   cp .env.minio.example .env.minio
   ```
2. Levanta MySQL + MinIO:
   ```bash
   docker compose --env-file .env.minio up -d
   ```
3. Consola web MinIO: [http://localhost:9101](http://localhost:9101)  
   API S3: `http://127.0.0.1:9100`  
   (Puertos **9100/9101** para no chocar con otros MinIO en 9000/9001.)
4. Configura el backend (`apps/backend/.env`) con las variables de `apps/backend/.env.example`
   (`MINIO_ENDPOINT`, `MINIO_PORT=9100`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL=false`).
5. El servicio `minio-init` crea el bucket `squadveloce-players` con política **privada**.
6. Si el **backend corre en Docker** y MinIO en el host, usa en `.env.production`:
   - `MINIO_ENDPOINT=host.docker.internal` / `MINIO_PORT=9100` (API interna)
   - `MINIO_PUBLIC_ENDPOINT=127.0.0.1` / `MINIO_PUBLIC_PORT=9100` (URLs firmadas para el navegador)

La subida de foto pasa por el BFF de Astro con `security.checkOrigin: true`. En Docker hay que
definir `ASTRO_SITE` y `ASTRO_ALLOWED_ORIGINS` (p. ej. `http://127.0.0.1:9082`) en el build de `web`
para que el Host público coincida con el `Origin` del navegador. **No** desactivar `checkOrigin`.
