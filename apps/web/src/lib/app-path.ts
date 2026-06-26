/** Ruta absoluta respetando el base de Astro (p. ej. `/profe` en producción). */
export function appPath(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (base === '/') return normalizedPath;
  return `${base.replace(/\/$/, '')}${normalizedPath}`;
}
