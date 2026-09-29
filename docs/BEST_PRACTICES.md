# Mejores Prácticas de Desarrollo

## Estructura de Código

### ✅ Componente Bien Estructurado

```tsx
// PlayerCard.tsx
import type { ReactNode } from 'react';
import { Badge } from '@velocesport/design-system';
import { formatDate } from '../../lib/formatters';

export interface PlayerCardProps {
  id: number;
  name: string;
  position: string;
  joinDate: Date;
  actions?: ReactNode;
}

export function PlayerCard({
  id,
  name,
  position,
  joinDate,
  actions,
}: PlayerCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-600">{position}</p>
        </div>
        <Badge>{formatDate(joinDate)}</Badge>
      </div>
      {actions && <div className="mt-4">{actions}</div>}
    </div>
  );
}
```

### ❌ Evitar

```tsx
// Mal: Lógica compleja en componente
export function PlayerCard(props) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`/api/players/${props.id}`)
      .then(r => r.json())
      .then(setData);
  }, []);

  return <div>{data?.name}</div>;
}

// Mal: Sin tipos
function Card({id, name, position}) {
  // ...
}

// Mal: Lógica duplicada
if (player.status === 'active') {
  // mostrar componente A
}
```

---

## Manejo de Estado

### ✅ Usar Hooks del Design System

```tsx
import { useFetch, useForm, useNotification } from '@velocesport/design-system';

export function UpdatePlayerForm({ playerId }: { playerId: number }) {
  const { data: player, isLoading } = useFetch(`/api/players/${playerId}`);
  const { success, error: showError } = useNotification();

  const form = useForm({
    initialValues: player || { name: '', position: '' },
    onSubmit: async (values) => {
      try {
        await fetch(`/api/players/${playerId}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        success('Actualizado');
      } catch (err) {
        showError('Error al actualizar');
      }
    },
  });

  if (isLoading) return <LoadingState />;

  return <form onSubmit={form.handleSubmit}>{/* ... */}</form>;
}
```

### ❌ Evitar

```tsx
// Mal: useState en todo lugar
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [touched, setTouched] = useState({});
const [errors, setErrors] = useState({});
// ... más useState

// Mal: Fetch en componente
useEffect(() => {
  setLoading(true);
  fetch('/api/data')
    .then(r => r.json())
    .then(d => { setData(d); setLoading(false); })
    .catch(e => { setError(e); setLoading(false); });
}, []);
```

---

## Formularios

### ✅ Con Validación Centralizada

```tsx
import { useForm, createFieldProps, FormField, FormActions, Button } from '@velocesport/design-system';

export function CreatePlayerForm() {
  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      position: '',
      number: '',
    },
    validate: (values) => {
      const errors: Partial<Record<keyof typeof values, string>> = {};
      if (!values.name?.trim()) errors.name = 'Nombre requerido';
      if (!values.email?.includes('@')) errors.email = 'Email inválido';
      if (!values.position) errors.position = 'Posición requerida';
      if (isNaN(Number(values.number))) errors.number = 'Número debe ser numérico';
      return errors;
    },
    onSubmit: async (values) => {
      const response = await fetch('/api/players', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      // handle response
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <FormField label="Nombre" required error={form.errors.name} htmlFor="name">
        <input id="name" {...createFieldProps('name', form)} />
      </FormField>

      <FormField label="Email" required error={form.errors.email} htmlFor="email">
        <input id="email" type="email" {...createFieldProps('email', form)} />
      </FormField>

      <FormField label="Posición" required error={form.errors.position} htmlFor="position">
        <input id="position" {...createFieldProps('position', form)} />
      </FormField>

      <FormActions>
        <Button type="button" variant="ghost">Cancelar</Button>
        <Button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Guardando...' : 'Guardar'}
        </Button>
      </FormActions>
    </form>
  );
}
```

### ❌ Evitar

```tsx
// Mal: Sin validación centralizada
const [name, setName] = useState('');
const [nameError, setNameError] = useState('');
const [email, setEmail] = useState('');
const [emailError, setEmailError] = useState('');
// ... más estado

const handleNameChange = (e) => {
  setName(e.target.value);
  if (!e.target.value) setNameError('Requerido');
};

// Mal: Validación en submit
const handleSubmit = () => {
  if (!name) setNameError('Requerido');
  if (!email.includes('@')) setEmailError('Inválido');
  // ...
};
```

---

## Control de Acceso

### ✅ En Servidor (Astro)

```tsx
// apps/web/src/pages/dashboard/coach/analysis.astro
---
import { getSession } from '../../../lib/session';
import { redirectUnlessRole } from '../../../lib/page-access';

const session = getSession(Astro.cookies);
const accessDenied = redirectUnlessRole(session, 'coach');
if (accessDenied) return Astro.redirect(accessDenied);

const locale = Astro.locals.locale;
---

<BaseLayout>
  <CoachAnalysisPage client:load />
</BaseLayout>
```

**Ventajas:**
- ✅ Control de acceso antes de renderizar
- ✅ No expone datos al cliente
- ✅ Redirige inmediatamente

### ❌ Evitar

```tsx
// Mal: Control en cliente
export function AnalysisPage() {
  if (session.role !== 'coach') {
    return <Redirect to="/forbidden" />;
  }
  return <Analysis />;
}

// Mal: Confiar en cliente
if (!user.hasPermission('view_analysis')) {
  // Pero el usuario vio todo el HTML
}
```

---

## Comunicación con API

### ✅ Usar BFF Pattern

```tsx
// Siempre ir a /api/* en la web
// Nunca llamar directamente al backend

const response = await fetch('/api/players', {
  method: 'POST',
  body: JSON.stringify({ name: 'John' }),
});
const data = await response.json();

// apps/web/src/pages/api/players/index.ts
export async function POST(request: AstroRequest) {
  const session = getSession(request.cookies);
  const body = await request.json();

  // Validar en servidor
  if (!body.name?.trim()) {
    return new Response('Invalid name', { status: 400 });
  }

  // Llamar al backend interno
  const response = await fetch(`${INTERNAL_API_URL}/players`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  return response;
}
```

---

## Manejo de Errores

### ✅ Centralizado

```tsx
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useNotification } from '@velocesport/design-system';

export function LoadDataButton() {
  const { handleError } = useErrorHandler();
  const { success } = useNotification();

  const handleClick = async () => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      success('Datos cargados');
    } catch (err) {
      handleError(err, 'Error al cargar datos');
    }
  };

  return <button onClick={handleClick}>Cargar</button>;
}
```

### ❌ Evitar

```tsx
// Mal: Sin manejo de errores
const handleClick = async () => {
  const response = await fetch('/api/data');
  const data = await response.json();
  setData(data);
};

// Mal: Errores silenciosos
try {
  await fetch(...);
} catch (err) {
  console.log('error'); // Sin notificación al usuario
}
```

---

## Performance

### ✅ Lazy Loading

```tsx
import { lazy, Suspense } from 'react';
import { LoadingState } from '@velocesport/design-system';

const HeavyChart = lazy(() => import('./HeavyChart'));

export function Dashboard() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HeavyChart />
    </Suspense>
  );
}
```

### ✅ Memoización Cuando Sea Necesario

```tsx
import { memo } from 'react';

export const PlayerCard = memo(function PlayerCard({ player }: PlayerCardProps) {
  return <div>{player.name}</div>;
});
```

---

## Accesibilidad

### ✅ Labels y ARIA

```tsx
<FormField label="Nombre" required htmlFor="playerName">
  <input
    id="playerName"
    aria-invalid={!!form.errors.name}
    aria-describedby={form.errors.name ? 'playerName-error' : undefined}
  />
  {form.errors.name && (
    <span id="playerName-error" className="text-red-600">
      {form.errors.name}
    </span>
  )}
</FormField>
```

### ✅ Keyboard Navigation

```tsx
import { useKeyDown } from '@velocesport/design-system';

export function Modal({ onClose }: { onClose: () => void }) {
  useKeyDown('Escape', onClose);
  
  return (
    <div role="dialog" aria-modal="true">
      {/* Contenido */}
    </div>
  );
}
```

---

## Testing

### ✅ Estructura

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerCard } from './PlayerCard';

describe('PlayerCard', () => {
  it('should render player name', () => {
    render(
      <PlayerCard
        id={1}
        name="John Doe"
        position="Delantero"
        joinDate={new Date()}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Delantero')).toBeInTheDocument();
  });

  it('should call action when clicked', () => {
    const onClick = vi.fn();
    render(
      <PlayerCard
        id={1}
        name="John"
        position="Delantero"
        joinDate={new Date()}
        actions={<button onClick={onClick}>Edit</button>}
      />
    );

    screen.getByRole('button', { name: /edit/i }).click();
    expect(onClick).toHaveBeenCalled();
  });
});
```

---

## Documentación

### ✅ Comentarios Necesarios

```tsx
// Componentes complejos
export function ComplexComponent() {
  // Resolvemos el token JWT para validar la sesión sin hacer
  // una llamada adicional al backend
  const token = getTokenFromCookie();

  return <div>{/* ... */}</div>;
}
```

### ❌ Comentarios Innecesarios

```tsx
// Malo: Comentarios obvios
// Establecer el estado
setState(true);

// Malo: Comentarios que repiten el código
// Si el usuario no es coach, no mostrar
if (user.role !== 'coach') return null;
```

---

## Checklista de PR

- [ ] ¿Los componentes son reutilizables?
- [ ] ¿Se usan los nuevos layouts (PageContainer, PageHeader)?
- [ ] ¿Se maneja el loading state con DataContainer?
- [ ] ¿Se muestran errores al usuario con useNotification?
- [ ] ¿Los formularios usan useForm con validación?
- [ ] ¿Hay TypeScript types para todo?
- [ ] ¿Es responsive en mobile?
- [ ] ¿Tiene aria-labels en elementos interactivos?
- [ ] ¿Se evita estado global innecesario?
- [ ] ¿Hay duplicación de código?
