# Arquitectura y Patrones de SquadVeloce

## Visión General

SquadVeloce es una plataforma SaaS multi-tenant con una arquitectura clara basada en:
- **Frontend**: Astro SSR + React islands
- **Backend**: Express + MySQL
- **BFF Pattern**: Las rutas en `apps/web/src/pages/api/*` actúan como Backend For Frontend

```
Navegador → Web (Astro SSR + React) → API Routes (BFF) → Backend API
                                    ↓
                           Cookies httpOnly con JWT
```

## Estructura de Carpetas

### `apps/web/src/`

```
components/
├── common/          # Componentes compartidos reutilizables
├── layout/          # Componentes de layout y shell
├── auth/            # Autenticación
├── [feature]/       # Componentes por feature (coach, parent, player, etc.)
pages/
├── api/             # Rutas BFF (Backend For Frontend)
├── dashboard/       # Páginas autenticadas por rol
├── login.astro      # Autenticación pública
└── signup.astro
lib/
├── session.ts       # Gestión de sesiones
├── page-access.ts   # Control de acceso por roles
├── navigation.ts    # Configuración de navegación
hooks/
├── useNotification.ts  # Notificaciones mejoradas
├── useErrorHandler.ts  # Manejo centralizado de errores
└── [otros hooks]/
styles/
└── global.css       # Estilos globales
```

### `packages/design-system/src/`

```
components/
├── PageContainer.tsx     # Contenedor principal de página
├── PageHeader.tsx        # Encabezado de página con título/acciones
├── PageSection.tsx       # Secciones dentro de páginas
├── StateDisplay.tsx      # Loading, Error, Empty states
├── FormField.tsx         # Campos de formulario con validación
├── ErrorBoundary.tsx     # Error boundary para React
├── Breadcrumbs.tsx       # Navegación con breadcrumbs
└── [otros componentes]/
hooks/
├── useFetch.ts          # Fetch con estado y error handling
├── useForm.ts           # Formularios con validación
├── useAccessibility.ts  # Accesibilidad (focus trap, keyboard nav)
└── [otros hooks]/
```

## Patrones Clave

### 1. Componentes de Página

```tsx
// apps/web/src/pages/dashboard/coach/players.astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
import DashboardShell from '../../../components/layout/DashboardShell';
import { getSession } from '../../../lib/session';
import { redirectUnlessRole } from '../../../lib/page-access';

const session = getSession(Astro.cookies);
const accessDenied = redirectUnlessRole(session, 'coach');
if (accessDenied) return Astro.redirect(accessDenied);
---

<BaseLayout>
  <DashboardShell
    client:load
    role={session.role}
    pageId="players-list"
    pageTitle="Jugadores"
  />
</BaseLayout>
```

**Puntos clave:**
- Control de acceso en servidor con `redirectUnlessRole`
- Props pasadas al DashboardShell (componente React)
- `client:load` para hacer interactivo el componente

### 2. Componentes de Layout Mejorados

```tsx
// Ejemplo usando nuevos componentes
import { PageContainer, PageHeader, PageSection, DataContainer } from '@velocesport/design-system';

export function CoachPlayersPage() {
  const { data, isLoading, isError, error } = useFetch('/api/players');

  return (
    <PageContainer maxWidth="xl" padding="lg">
      <PageHeader
        title="Jugadores"
        description="Gestiona todos tus jugadores"
        action={<CreatePlayerButton />}
      />
      
      <PageSection title="Lista de Jugadores">
        <DataContainer
          isLoading={isLoading}
          isError={isError}
          isEmpty={data?.length === 0}
          error={error?.message}
          emptyMessage="No hay jugadores"
        >
          <ResponsiveList items={data} columns={playerColumns} />
        </DataContainer>
      </PageSection>
    </PageContainer>
  );
}
```

### 3. Formularios con Validación

```tsx
import { useForm } from '@velocesport/design-system';
import { FormField, FormGroup, FormActions, Button } from '@velocesport/design-system';

interface CreatePlayerForm {
  name: string;
  email: string;
  position: string;
}

export function CreatePlayerForm() {
  const form = useForm<CreatePlayerForm>({
    initialValues: { name: '', email: '', position: '' },
    validate: (values) => {
      const errors: Partial<Record<keyof CreatePlayerForm, string>> = {};
      if (!values.name) errors.name = 'El nombre es requerido';
      if (!values.email) errors.email = 'El email es requerido';
      return errors;
    },
    onSubmit: async (values) => {
      await fetch('/api/players', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <FormGroup>
        <FormField
          label="Nombre"
          required
          error={form.errors.name}
          htmlFor="name"
        >
          <input
            id="name"
            {...createFieldProps('name', form)}
          />
        </FormField>
        <FormField
          label="Email"
          required
          error={form.errors.email}
          htmlFor="email"
        >
          <input
            id="email"
            type="email"
            {...createFieldProps('email', form)}
          />
        </FormField>
      </FormGroup>
      
      <FormActions>
        <Button type="submit">Crear</Button>
      </FormActions>
    </form>
  );
}
```

### 4. Data Fetching

```tsx
import { useFetch, useAsync } from '@velocesport/design-system';

// Fetch simple con estado
const { data, isLoading, isError, error, refetch } = useFetch('/api/players');

// Función asíncrona compleja
const { data, isLoading, isError } = useAsync(
  async () => {
    const res = await fetch('/api/report');
    return res.json();
  },
  [dependencyId],
);
```

### 5. Manejo de Errores y Notificaciones

```tsx
import { useNotification } from '../hooks/useNotification';
import { useErrorHandler } from '../hooks/useErrorHandler';

export function UpdatePlayerForm() {
  const { success, error: showError } = useNotification();
  const { handleError } = useErrorHandler();

  const handleSubmit = async (values: PlayerForm) => {
    try {
      await fetch(`/api/players/${playerId}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      success('Jugador actualizado');
    } catch (err) {
      handleError(err, 'Error al actualizar jugador');
    }
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

### 6. Accesibilidad

```tsx
import { useFocusTrap, useKeyDown, useDialog } from '@velocesport/design-system';

export function AccessibleModal({ isOpen, onClose }) {
  const dialogRef = useDialog({ isOpen, onClose });
  const focusRef = useFocusTrap(isOpen);

  // ESC cierra el modal
  useKeyDown('Escape', onClose);

  return (
    <div ref={focusRef} role="dialog" aria-modal="true">
      {/* Contenido del modal */}
    </div>
  );
}
```

## Convenciones

### Nombres de Archivos

- **Componentes React**: `PascalCase.tsx` (ej: `PlayerCard.tsx`)
- **Hooks**: `camelCase.ts` (ej: `usePlayerData.ts`)
- **Utilidades**: `camelCase.ts` (ej: `dateFormatters.ts`)
- **Páginas Astro**: `kebab-case.astro` (ej: `create-player.astro`)

### Organización de Componentes

1. **Imports**: Librerías, tipos, componentes, hooks
2. **Tipos/Interfaces**: Definir primero
3. **Componente**: Función principal
4. **Helpers**: Funciones auxiliares al final

```tsx
// Estructura estándar
import type { ReactNode } from 'react';
import { Button } from '@velocesport/design-system';

interface PlayerCardProps {
  name: string;
  position: string;
  avatar?: string;
}

export function PlayerCard({ name, position, avatar }: PlayerCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      {/* contenido */}
    </div>
  );
}
```

### Estilos

- **Tailwind CSS**: Preferencia principal
- **Utility-first**: Mantener estilos inline
- **Dark mode**: Usar `dark:` prefix para modo oscuro
- **Componentes**: Usar tokens del design-system

```tsx
<div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
  {/* ... */}
</div>
```

## Mejores Prácticas

### ✅ Hacer

- Usar `DataContainer` para manejar loading/error/empty states
- Validar acceso en servidor antes de renderizar
- Usar FormField + useForm para formularios
- Centralizar llamadas API en hooks
- Documentar props complejas con JSDoc
- Usar error boundaries para capturar errores React

### ❌ Evitar

- Llamar directamente al backend desde la web
- Lógica de validación duplicada en múltiples componentes
- Estado global innecesario
- Componentes sin props tipadas
- Ignorar mensajes de error en catch blocks

## Testing

```bash
# Tests en web app
pnpm --filter @velocesport/web test

# Tests en backend
pnpm --filter @velocesport/backend test

# Tests en i18n
pnpm --filter @velocesport/i18n test
```

## Despliegue

Ver [README.md](./README.md) para instrucciones de despliegue.
