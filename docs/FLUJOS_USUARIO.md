# Flujos de usuario en VeloceSports

Documento de referencia sobre cómo cada rol usa el sistema, desde el registro hasta la operación diaria. Se basa en el código de `apps/backend` (rutas, servicios, middlewares) y `apps/web` (`middleware.ts`, páginas).

Roles de login: `super_admin`, `academy_admin`, `coach`, `parent`, `player` (definidos en `packages/shared/src/roles.ts`).

## 1. Arquitectura general

```mermaid
flowchart LR
    subgraph Web["apps/web (Astro SSR)"]
        MW["middleware.ts<br/>sesión + rol + mustChangePassword"]
        PUB["Páginas públicas<br/>/login /signup /forgot-password /reset-password"]
        DASH["/dashboard/&lt;rol&gt;/*"]
        BFF["pages/api/* (BFF proxy)"]
    end
    subgraph API["apps/backend (Express)"]
        AUTHMW["authenticate → tenant → requireRole → validate"]
        AUTHR["/auth/*"]
        PLAT["/api/platform/*<br/>super_admin"]
        TEN["/api/tenant/*<br/>academy_admin · coach"]
        PAR["/api/parent/*<br/>parent"]
        PLY["/api/player/*<br/>player"]
        COACH["/api/coach/analysis/*<br/>coach · academy_admin"]
        SVC["Services → Repositories"]
    end
    DB[("MySQL")]
    MAIL["Email (SMTP)"]

    PUB --> BFF
    DASH --> BFF
    MW -.guard.-> DASH
    BFF --> AUTHMW
    AUTHMW --> AUTHR & PLAT & TEN & PAR & PLY & COACH
    AUTHR & PLAT & TEN & PAR & PLY & COACH --> SVC --> DB
    SVC --> MAIL
```

## 2. Registro: tres caminos

```mermaid
flowchart TD
    START([Visitante]) --> CHOICE{¿Qué tipo de cuenta?}

    CHOICE -->|Padre sin academia| P1["POST /auth/signup-independent<br/>padre + hijo"]
    P1 --> P2["Crea academia 'Familia X'<br/>accountType=PERSONAL<br/>status=INACTIVE, approval=PENDING"]
    P2 --> P3["Crea categoría 'Mi equipo'<br/>+ catálogo de acciones base"]
    P3 --> P4["Usuario PARENT + rol COACH<br/>jugador hijo ACTIVE<br/>vínculo parent↔hijo, coach de categoría"]
    P4 --> PEND

    CHOICE -->|Academia real| A1["POST /auth/signup-academy<br/>academia + admin"]
    A1 --> A2["Crea academia<br/>status=INACTIVE, approval=PENDING"]
    A2 --> A3["Usuario ACADEMY_ADMIN"]
    A3 --> PEND

    CHOICE -->|Lo da de alta un admin| ADM["Academy admin / coach<br/>no hay registro público"]
    ADM --> ADM1["POST /api/tenant/users<br/>contraseña temporal generada"]
    ADM --> ADM2["POST /api/tenant/players/:id/invite-adult<br/>jugador adulto con contraseña temporal"]

    PEND["Notifica al ADMIN_NOTIFICATION_EMAIL<br/>queda pendiente de aprobación"] --> SA{"super_admin revisa"}
    SA -->|approve| OK["approval=APPROVED<br/>email de decisión al dueño"]
    SA -->|reject| NO["approval=REJECTED<br/>email de decisión"]
    OK --> LOGIN([Puede iniciar sesión])
```

> **Nota:** el login bloquea cualquier academia con `approval_status = PENDING` (`auth.service.ts`). Las cuentas personales también quedan en `PENDING`, y no hay auto-aprobación para ellas. Un padre que se registra no puede entrar hasta que un super_admin lo apruebe.

## 3. Login y puerta de acceso

```mermaid
flowchart TD
    L([POST /auth/login<br/>rate limit]) --> V{Credenciales válidas?}
    V -->|No| E401[401 Credenciales inválidas]
    V -->|Sí| ST{user.status = active?}
    ST -->|No| E403A[403 Usuario inactivo]
    ST -->|Sí| RS{Combinación de roles válida?<br/>super_admin no mezcla roles}
    RS -->|No| E403B[403 Rol sin acceso]
    RS -->|Sí| SA{¿Es super_admin?}
    SA -->|Sí| TOK
    SA -->|No| AP{approval_status}
    AP -->|PENDING| E403C[403 Pendiente de aprobación]
    AP -->|REJECTED| E403D[403 Solicitud no aprobada]
    AP -->|APPROVED| AC{academy.status}
    AC -->|SUSPENDED| E403E[403 Academia suspendida]
    AC -->|no ACTIVE| E403F[403 Academia no activa]
    AC -->|ACTIVE| TOK[Access token + refresh token]
    TOK --> MCP{must_change_password?}
    MCP -->|Sí| CPR[/dashboard/change-password-required]
    MCP -->|No| RED{Redirige por rol}
    RED --> D1[/dashboard/super-admin]
    RED --> D2[/dashboard/academy-admin]
    RED --> D3[/dashboard/coach]
    RED --> D4[/dashboard/parent]
    RED --> D5[/dashboard/player]
```

`middleware.ts` vuelve a validar cada ruta `/dashboard/*`: sin sesión redirige a `/login?redirect=...`; con un rol que no corresponde, lo devuelve a su dashboard.

## 4. Qué hace cada usuario

```mermaid
flowchart LR
    subgraph SA["super_admin (plataforma)"]
        direction TB
        S1[Aprobar / rechazar academias]
        S2[Cuentas personales]
        S3[Planes y suscripciones]
        S4[Facturación y facturas vencidas]
        S5[Auditoría y métricas]
        S6[Crear otros super_admin]
    end
    subgraph AA["academy_admin (academia)"]
        direction TB
        A1[Usuarios: crear, bulk, roles, estado, reset]
        A2[Categorías y jugadores]
        A3[Aprobar o rechazar jugadores de padres]
        A4[Invitar jugador adulto]
        A5[Partidos, catálogo de acciones]
        A6[Reportes CSV/PDF, configuración, facturación]
    end
    subgraph CO["coach (en sus categorías)"]
        direction TB
        C1[Crear y operar partidos en vivo]
        C2[Asistencia, reloj, acciones]
        C3[Observaciones y análisis de jugadores]
        C4[Invitar jugador adulto de su categoría]
    end
    subgraph PA["parent (padre/tutor)"]
        direction TB
        P1[Inscribir hijo, queda PENDING]
        P2[Ver hijos, dashboard, calendario]
        P3[Ver partido en vivo, reportes e insights]
        P4[Notificaciones y preferencias]
    end
    subgraph PL["player (adulto)"]
        direction TB
        Y1[Perfil propio y actualizar datos]
        Y2[Dashboard, calendario, partidos]
        Y3[Reportes, insights y observaciones]
    end
```

## 5. Ciclo de un partido

```mermaid
stateDiagram-v2
    [*] --> scheduled: POST /api/tenant/matches<br/>(o /bulk)
    scheduled --> scheduled: asistencia, editar, acciones de catálogo
    scheduled --> in_progress: PATCH /:id/status<br/>o arranque de reloj
    in_progress --> in_progress: POST /:id/clock<br/>POST /:id/actions<br/>immediate / void
    in_progress --> finished: PATCH /:id/status
    scheduled --> cancelled: POST /:id/cancel
    in_progress --> cancelled: POST /:id/cancel
    finished --> [*]
    cancelled --> [*]
```

## 6. Recuperación de contraseña

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Web (/forgot-password)
    participant A as Backend /auth
    participant DB as MySQL
    participant M as Email

    U->>W: Ingresa correo
    W->>A: POST /auth/password-recovery/request
    A->>DB: Guarda token con expiración (TTL configurable)
    A->>M: Envía enlace
    A-->>W: 202 siempre (no revela si existe)
    U->>W: Abre enlace /reset-password?token=...
    W->>A: POST /auth/password-recovery/confirm
    A->>DB: Valida token (no usado, no vencido), actualiza hash
    A->>DB: Revoca sesiones
    A-->>W: 200 contraseña actualizada
```

## Pendientes conocidos

1. **Acceso de cuentas personales:** requieren aprobación manual de super_admin. Confirmar si es el comportamiento deseado o si la UI de registro debe indicarlo.
2. **Contraseña temporal en la respuesta de la API:** `POST /api/tenant/users` y `POST /api/tenant/players/:id/invite-adult` devuelven la contraseña temporal en claro. Revisar cómo se entrega al usuario.
