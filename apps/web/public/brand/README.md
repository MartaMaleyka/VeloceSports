# Brand assets — SquadVeloce

Archivos en esta carpeta (provisionales):

| Archivo | Uso |
|---------|-----|
| `logo-dark.png` | Logo completo sobre fondo oscuro (hero login) |
| `logo-light.png` | Logo completo sobre fondo claro |
| `favicon.ico` / `favicon.png` | Favicon (derivado del logo dark) |
| `apple-touch-icon.png` | Icono iOS 180×180 |
| `og-image.png` | Open Graph 1200×630 |

Los PNG del logo light pueden tener fondo sólido; **`logo-dark.png` usa canal alpha**
(fondo transparente) para encajar sobre el hero sin bloque negro.

## Sidebar — stopgap monograma SVG

Los PNG full-logo a 40×40 en el sidebar dejaban un **cuadrado de fondo** visible
(sobre todo en modo oscuro: negro del PNG ≠ `#0b0b0f` del sidebar). Un `mix-blend-mode`
no quedó limpio.

**Solución actual:** el sidebar usa el componente React
`apps/web/src/components/brand/SquadVeloceMonogram.tsx` — SVG inline solo del
isotipo (S + V/check + estrella de velocidad), sin wordmark, banda de íconos ni eslogan.
Login/hero siguen con los PNG completos.

### Cuando lleguen los SVG del diseñador

1. Añadir p. ej. `isotype-light.svg` / `isotype-dark.svg` (o un único SVG con `currentColor`).
2. En `Sidebar.tsx` → `BrandMark`, cargar esos assets (o reemplazar el JSX del monograma).
3. Borrar `SquadVeloceMonogram.tsx` si ya no se usa.
4. Actualizar esta tabla.

Slogan de marca: **Desde aquí nace el talento**.
