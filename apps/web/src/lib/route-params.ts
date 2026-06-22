/** Resuelve un id numérico desde props de Astro o la URL actual (fallback). */
export function resolveNumericRouteId(propValue: unknown, pattern: RegExp): number {
  const fromProp = Number(propValue);
  if (Number.isInteger(fromProp) && fromProp > 0) return fromProp;

  if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(pattern);
    if (match?.[1]) {
      const fromPath = Number(match[1]);
      if (Number.isInteger(fromPath) && fromPath > 0) return fromPath;
    }
  }

  return 0;
}
