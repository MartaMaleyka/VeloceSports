import { resolveRequiresGuardian } from '@velocesport/shared';

describe('resolveRequiresGuardian', () => {
  it('NULL + ageMax < 18 requiere tutor', () => {
    expect(resolveRequiresGuardian({ requiresGuardian: null, ageMax: 16 })).toBe(true);
  });

  it('NULL + ageMax ausente requiere tutor', () => {
    expect(resolveRequiresGuardian({ requiresGuardian: null, ageMax: null })).toBe(true);
  });

  it('NULL + ageMax >= 18 no requiere tutor', () => {
    expect(resolveRequiresGuardian({ requiresGuardian: null, ageMax: 18 })).toBe(false);
  });

  it('0 fuerza adulto aunque ageMax < 18', () => {
    expect(resolveRequiresGuardian({ requiresGuardian: 0, ageMax: 16 })).toBe(false);
  });

  it('1 fuerza tutor aunque ageMax >= 18', () => {
    expect(resolveRequiresGuardian({ requiresGuardian: 1, ageMax: 21 })).toBe(true);
  });
});
