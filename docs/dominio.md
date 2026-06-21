# Referencia de dominio — SaaS Academias de Fútbol

Documento de contexto para el equipo y para Cursor. Resume entidades, módulos y
reglas del documento de Requerimientos Funcionales v1.0. **No** sustituye al
documento original; lo destila para uso técnico.

## Actores / roles
- `super_admin` — plataforma global: crea academias, activa/suspende tenants,
  gestiona planes, métricas SaaS.
- `academy_admin` — operación interna de su academia: jugadores, entrenadores,
  padres, categorías, partidos, acciones, reportes.
- `coach` — categorías asignadas, asistencia, captura de acciones en vivo,
  observaciones técnicas, finalizar partido.
- `parent` — notificaciones y reportes SOLO de sus hijos vinculados.
- `player` — entidad de datos; sin acceso en MVP.

## Entidades principales (todas operativas llevan `tenant_id`)
- **Academy (tenant)**: nombre, identificador único, estado (active/suspended/inactive),
  plan, zona horaria, idioma, moneda, logo, config (duplicidad de dorsal, multi-categoría,
  periodos de juego).
- **User**: tabla única para todos los roles. `email` único global, `password_hash`,
  `role`, `tenant_id` (NULL solo para super_admin; obligatorio para el resto),
  `status`, último acceso. UN solo login/endpoint para los cuatro roles.
- **Plan**: nombre, descripción, límites (jugadores, categorías, usuarios, partidos/mes).
- **Category**: nombre (Sub-7…Sub-15 o custom), rango de edad, estado, entrenador
  principal.
- **Player**: nombre, fecha nac., categoría(s), número de camiseta, posición,
  estado (active/inactive/injured/retired), padre(s) vinculado(s).
- **Parent (user)**: rol `parent` ligado a un tenant. Vinculado a UNO o VARIOS
  jugadores vía `parent_players` (N:M). Solo ve datos de sus jugadores vinculados.
- **Coach (user)**: rol `coach` ligado a UN tenant. Vinculado a UNA o VARIAS
  categorías vía `coach_categories` (N:M). Solo opera sus categorías asignadas.
- **Match**: categoría, rival, fecha/hora, lugar, tipo, estado
  (scheduled/in_progress/finished/cancelled), marcador.
- **Attendance**: match + player, titular/suplente, minutos jugados.
- **ActionCatalog**: código, nombre, descripción, impacto (positive/negative/neutral),
  notificable (bool), estado. Catálogo base se siembra al crear tenant.
- **GameAction** (registro en vivo): match, player, action_code, minuto, periodo,
  created_by (coach), created_at. Trazabilidad inmutable.
- **Notification**: action, parent, canal, estado de envío, fecha.
- **Report**: general de partido / individual por jugador / evolución por periodo.
- **AuditLog**: tenant, user, entity, entity_id, action, before, after, timestamp.

## Catálogo base de acciones (semilla por tenant)
| Código | Acción | Impacto | Notificable |
|---|---|---|---|
| 1 | Gol | positive | sí |
| 2 | Asistencia | positive | sí |
| 3 | Pase completado | positive | no |
| 4 | Pase errado | negative | no |
| 5 | Tiro al arco | positive | sí |
| 6 | Tiro desviado | neutral | no |
| 7 | Falta cometida | negative | no |
| 8 | Falta recibida | positive | no |
| 9 | Pérdida de balón | negative | no |
| 10 | Intercepción | positive | sí |
| 11 | Quite | positive | sí |
| 12 | Despeje | positive | no |
| 13 | Recuperación del balón | positive | sí |
| 14 | Atajada | positive | sí |
| 15 | Salida incorrecta | negative | no |

## Captura `N-M` (corazón del producto)
`7-13` → jugador con dorsal 7 ejecuta la acción código 13 (Recuperación del balón),
asociada al minuto, periodo y partido en curso. Validar que el dorsal pertenece a un
jugador **asistente** y que la acción está **activa** en el catálogo del tenant.

## Reglas de negocio críticas
- RN-02: todo registro operativo lleva `tenant_id`.
- RN-03: un usuario no accede a datos de otra academia.
- RN-05: jugador necesita ≥1 categoría activa para participar.
- RN-07: solo asistentes reciben acciones.
- RN-08: solo partidos `in_progress` aceptan acciones.
- RN-09/RN-18: notificar solo si acción notificable + canal del padre activo + prefs ok.
- RN-12/RN-13: acción guarda trazabilidad; corregir no borra la original.
- RN-16: partido finalizado no acepta acciones salvo corrección autorizada.
- RN-17: recalcular estadísticas tras corrección/eliminación.

## Módulos (RF agrupados)
Multi-tenant (RF-MT), Onboarding (RF-ONB), Planes (RF-PLAN), Config tenant (RF-CFG),
Academias (RF-ACA), Usuarios/Roles (RF-USR), Categorías (RF-CAT), Jugadores (RF-JUG),
Padres (RF-PAD), Entrenadores (RF-ENT), Partidos (RF-PAR), Asistencia (RF-ASI),
Catálogo de acciones (RF-ACT), Captura en vivo (RF-CAP), Notificaciones (RF-NOT),
Reporte general (RF-RGP), Reporte individual (RF-RIJ), Evolución por periodo (RF-EVO),
Dashboard (RF-DASH), Auditoría (RF-AUD).

## Fuera del MVP (no construir todavía)
App móvil nativa, modo offline avanzado, integración con video, IA predictiva,
torneos complejos, WhatsApp Business API.

## Orden sugerido de construcción (MVP)
1. Cimientos: monorepo, design system (tokens/foundations), auth + multi-tenant
   (JWT, middleware tenant, RBAC), MySQL schema base, Swagger.
2. Gestión: academias/onboarding, usuarios/roles, categorías, jugadores, padres,
   entrenadores.
3. Operación de partido: crear partido → asistencia → **tablero de captura en vivo**
   → finalizar.
4. Salida: notificaciones, reporte general, reporte individual, evolución, dashboards.
5. Transversal continuo: auditoría, tests (con foco en aislamiento multi-tenant), docs.
