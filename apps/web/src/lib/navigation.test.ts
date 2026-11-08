import { describe, expect, it } from 'vitest';
import { getNavLayoutForRoles } from './navigation';

describe('getNavLayoutForRoles', () => {
  it('pone las secciones del rol principal antes que las de otros roles', () => {
    // Padre con rol coach (alta independiente): las secciones de padre van primero.
    const layout = getNavLayoutForRoles(['parent', 'coach'], 'es', 'parent');
    expect(layout.sections.map((s) => s.groupRole)).toEqual(['parent', 'coach']);
  });

  it('mantiene el orden por defecto cuando el rol principal es coach', () => {
    const layout = getNavLayoutForRoles(['parent', 'coach'], 'es', 'coach');
    expect(layout.sections.map((s) => s.groupRole)).toEqual(['coach', 'parent']);
  });

  it('usa el inicio del rol principal como inicio del menú', () => {
    const layout = getNavLayoutForRoles(['parent', 'coach'], 'es', 'parent');
    expect(layout.homeItem?.href).toContain('/dashboard/parent');
  });
});
