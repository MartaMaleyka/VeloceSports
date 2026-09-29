# Guía de Componentes

## Componentes de Layout

### PageContainer
Contenedor principal para todas las páginas, maneja espaciado y ancho máximo.

```tsx
<PageContainer maxWidth="xl" padding="lg">
  {/* contenido */}
</PageContainer>
```

**Props:**
- `maxWidth`: 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'xl')
- `padding`: 'none' | 'sm' | 'md' | 'lg' (default: 'lg')

---

### PageHeader
Encabezado de página con título, descripción, breadcrumbs y acciones.

```tsx
<PageHeader
  title="Jugadores"
  description="Gestiona tus jugadores"
  breadcrumbs={[
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Jugadores' },
  ]}
  action={<Button>+ Nuevo</Button>}
/>
```

**Props:**
- `title`: string (required)
- `description`: string | ReactNode
- `breadcrumbs`: Array<{ label: string; href?: string }>
- `action`: ReactNode

---

### PageSection
Sección dentro de una página con título y divisor opcional.

```tsx
<PageSection title="Información" description="Detalles del jugador">
  {/* contenido */}
</PageSection>
```

**Props:**
- `title`: string
- `description`: string
- `divider`: boolean (default: true)

---

## Componentes de Estado

### DataContainer
Maneja automáticamente loading, error, empty y estados de éxito.

```tsx
const { data, isLoading, isError, error } = useFetch('/api/players');

<DataContainer
  isLoading={isLoading}
  isError={isError}
  isEmpty={data?.length === 0}
  error={error?.message}
  emptyMessage="Sin jugadores"
  loadingMessage="Cargando jugadores..."
>
  <PlayersList players={data} />
</DataContainer>
```

**Props:**
- `isLoading`: boolean
- `isError`: boolean
- `isEmpty`: boolean
- `error`: string
- `emptyMessage`: string
- `loadingMessage`: string
- `errorAction`: ReactNode
- `emptyAction`: ReactNode

---

### LoadingState
Muestra indicador de carga con animación.

```tsx
<LoadingState message="Cargando datos..." />
```

---

### ErrorState
Muestra error con opción de acción.

```tsx
<ErrorState
  title="Error"
  message="No se pudieron cargar los datos"
  action={<Button onClick={refetch}>Reintentar</Button>}
/>
```

---

### EmptyStateDisplay
Estado vacío con mensaje y acción.

```tsx
<EmptyStateDisplay
  title="Sin resultados"
  message="Agrega tu primer jugador"
  action={<Button>+ Crear</Button>}
/>
```

---

## Componentes de Formulario

### FormField
Envuelve un input con label, error y validación.

```tsx
<FormField
  label="Nombre del Jugador"
  required
  error={form.errors.name}
  description="Nombre completo"
  htmlFor="playerName"
>
  <input
    id="playerName"
    {...createFieldProps('name', form)}
  />
</FormField>
```

**Props:**
- `label`: string (required)
- `error`: string
- `required`: boolean
- `description`: string
- `htmlFor`: string

---

### FormGroup
Agrupa múltiples campos con layout flexible.

```tsx
<FormGroup layout="grid" columns={2}>
  <FormField label="Nombre">
    <input />
  </FormField>
  <FormField label="Email">
    <input />
  </FormField>
</FormGroup>
```

**Props:**
- `layout`: 'vertical' | 'horizontal' | 'grid' (default: 'vertical')
- `columns`: number (default: 2)

---

### FormActions
Contenedor para botones de acción con alineación flexible.

```tsx
<FormActions align="right">
  <Button variant="ghost">Cancelar</Button>
  <Button type="submit">Guardar</Button>
</FormActions>
```

**Props:**
- `align`: 'left' | 'right' | 'center' | 'space-between' (default: 'right')

---

## Componentes Comunes (Web)

### ActionButton
Botón con soporte para estados de carga e iconos.

```tsx
<ActionButton
  icon={<PlusIcon />}
  loading={isSubmitting}
  loadingText="Creando..."
>
  Crear Jugador
</ActionButton>
```

---

### LoadingCard
Skeleton para tarjetas durante carga.

```tsx
<LoadingCard count={3} />
```

---

### ResponsiveList
Tabla responsive que se adapta a mobile.

```tsx
<ResponsiveList
  items={players}
  columns={[
    { key: 'name', label: 'Nombre' },
    { key: 'position', label: 'Posición' },
    {
      key: 'status',
      label: 'Estado',
      render: (value) => <Badge>{value}</Badge>,
    },
  ]}
  onRowClick={(item) => navigate(`/player/${item.id}`)}
/>
```

---

## Hooks

### useFetch
Fetch con estado automático.

```tsx
const { data, isLoading, isError, error, refetch } = useFetch(
  '/api/players',
  {
    method: 'GET',
    skip: !userId, // No ejecutar si no hay userId
  }
);
```

---

### useForm
Formularios con validación automática.

```tsx
const form = useForm({
  initialValues: { name: '', email: '' },
  validate: (values) => {
    const errors = {};
    if (!values.name) errors.name = 'Requerido';
    return errors;
  },
  onSubmit: async (values) => {
    await api.createPlayer(values);
  },
});

// Usar en JSX
<input {...createFieldProps('name', form)} />
```

---

### useNotification
Mostrar notificaciones.

```tsx
const { success, error, warning, info } = useNotification();

success('Guardado correctamente');
error('Error al guardar');
warning('Esta acción no se puede deshacer');
```

---

### useErrorHandler
Manejo centralizado de errores.

```tsx
const { handleError } = useErrorHandler();

try {
  await fetch(...);
} catch (err) {
  handleError(err, 'Error al cargar');
}
```

---

### useAccessibility
Hooks para accesibilidad.

```tsx
// Escuchar tecla
useKeyDown('Escape', onClose);
useKeyDown('Enter', onSubmit, { ctrlKey: true });

// Focus trap en modales
const containerRef = useFocusTrap(isModalOpen);

// Dialog con manejo automático de focus
const dialogRef = useDialog({ isOpen, onClose });

// Live region para screen readers
const { announce } = useAriaLiveRegion();
announce('Datos actualizados');
```

---

## Accesibilidad

### Breadcrumbs
```tsx
<Breadcrumbs
  items={[
    { label: 'Home', href: '/' },
    { label: 'Players', href: '/players' },
    { label: 'Player Detail', current: true },
  ]}
/>
```

---

### ErrorBoundary
```tsx
<ErrorBoundary
  onError={(error) => console.error(error)}
  fallback={<div>Error al cargar el componente</div>}
>
  <ComplexComponent />
</ErrorBoundary>
```

---

## Patrones Comunes

### Página con CRUD
```tsx
import { PageContainer, PageHeader, PageSection, DataContainer, useNotification } from '@velocesport/design-system';

export function PlayersPage() {
  const [isCreating, setIsCreating] = useState(false);
  const { data, isLoading, refetch } = useFetch('/api/players');
  const { success, error: showError } = useNotification();

  const handleCreate = async (values: PlayerForm) => {
    try {
      await fetch('/api/players', { method: 'POST', body: JSON.stringify(values) });
      success('Jugador creado');
      refetch();
    } catch (err) {
      showError('Error al crear');
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Jugadores"
        action={<CreatePlayerButton onSuccess={handleCreate} />}
      />
      
      <PageSection title="Lista">
        <DataContainer isLoading={isLoading} isEmpty={data?.length === 0}>
          <ResponsiveList items={data} columns={playerColumns} />
        </DataContainer>
      </PageSection>
    </PageContainer>
  );
}
```

---

## Checklista de Componentes

- [ ] ¿Usa PageContainer para la estructura base?
- [ ] ¿Usa PageHeader con titulo y acciones?
- [ ] ¿Usa DataContainer para estados de carga/error?
- [ ] ¿Tiene PropTypes/TypeScript tipado?
- [ ] ¿Es responsive (mobile-first)?
- [ ] ¿Tiene aria-labels apropiados?
- [ ] ¿Maneja errores con try/catch?
- [ ] ¿Usa useNotification para feedback del usuario?
