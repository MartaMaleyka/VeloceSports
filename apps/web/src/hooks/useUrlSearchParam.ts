export function readUrlSearchParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

export function readUrlSearchFlag(name: string): boolean {
  const value = readUrlSearchParam(name);
  return value === '1' || value === 'true';
}
