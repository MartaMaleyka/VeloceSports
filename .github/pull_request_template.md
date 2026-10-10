## Resumen

<!-- Qué cambia y por qué, en 2-4 líneas. -->

## Tipo de cambio

- [ ] Funcionalidad nueva
- [ ] Corrección de bug
- [ ] Refactor sin cambio de comportamiento
- [ ] Documentación / tooling

## Cambios principales

<!-- Lista corta por área: backend, web, shared, i18n, docs. -->

## Pruebas

- [ ] `pnpm --filter @velocesport/backend build` pasa
- [ ] `pnpm test:backend` pasa (requiere MySQL)
- [ ] `pnpm --filter @velocesport/i18n test` pasa si cambiaron textos
- [ ] `pnpm --filter @velocesport/web test` y `build` pasan si cambió el frontend
- [ ] Tests nuevos o actualizados para el código nuevo

Cómo se probó manualmente (si aplica):

<!-- Pasos, rol usado (super_admin, academy_admin, coach, parent, player) y resultado. -->

## Checklist de revisión (de CLAUDE.md)

- [ ] Presupuesto de rendimiento respetado en rutas críticas (si aplica)
- [ ] Logs con `correlationId` en rutas críticas
- [ ] Entrada validada con Zod, sin `as unknown as`
- [ ] Accesibilidad: ARIA y foco en componentes nuevos o modificados
- [ ] Sin consultas N+1; operaciones por lote cuando aplica
- [ ] Documentación actualizada (`CLAUDE.md`, `docs/`) si cambió un patrón o flujo

## Riesgos y despliegue

- [ ] Cambia autenticación, roles o facturación (revisión de CODEOWNERS)
- [ ] Requiere migración o backfill (indicar script)
- [ ] Requiere nueva variable de entorno (indicar en `.env.production.example`)
- [ ] Cambia textos de UI (revisar `es` y `en`)

<!-- Si marcas algún ítem de riesgo, explica el plan de rollback. -->
