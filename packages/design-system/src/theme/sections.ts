/**
 * Acentos de sección del panel — familia armónica (saturación/luminosidad similar).
 * Clases estáticas para compatibilidad con Tailwind JIT.
 */
export const SECTION_ACCENT_IDS = [
  'brand',
  'plans',
  'academies',
  'users',
  'billing',
  'matches',
  'super-admins',
  'audit',
] as const;

export type SectionAccentId = (typeof SECTION_ACCENT_IDS)[number];

const statCardClasses: Record<SectionAccentId, { card: string; icon: string }> = {
  brand: {
    card: 'border-section-brand-border bg-section-brand-subtle',
    icon: 'bg-section-brand-muted text-section-brand-fg',
  },
  plans: {
    card: 'border-section-plans-border bg-section-plans-subtle',
    icon: 'bg-section-plans-muted text-section-plans-fg',
  },
  academies: {
    card: 'border-section-academies-border bg-section-academies-subtle',
    icon: 'bg-section-academies-muted text-section-academies-fg',
  },
  users: {
    card: 'border-section-users-border bg-section-users-subtle',
    icon: 'bg-section-users-muted text-section-users-fg',
  },
  billing: {
    card: 'border-section-billing-border bg-section-billing-subtle',
    icon: 'bg-section-billing-muted text-section-billing-fg',
  },
  matches: {
    card: 'border-section-matches-border bg-section-matches-subtle',
    icon: 'bg-section-matches-muted text-section-matches-fg',
  },
  'super-admins': {
    card: 'border-section-super-admins-border bg-section-super-admins-subtle',
    icon: 'bg-section-super-admins-muted text-section-super-admins-fg',
  },
  audit: {
    card: 'border-section-audit-border bg-section-audit-subtle',
    icon: 'bg-section-audit-muted text-section-audit-fg',
  },
};

const badgeClasses: Record<SectionAccentId, string> = {
  brand: 'bg-section-brand-subtle text-section-brand-fg border-section-brand-border',
  plans: 'bg-section-plans-subtle text-section-plans-fg border-section-plans-border',
  academies: 'bg-section-academies-subtle text-section-academies-fg border-section-academies-border',
  users: 'bg-section-users-subtle text-section-users-fg border-section-users-border',
  billing: 'bg-section-billing-subtle text-section-billing-fg border-section-billing-border',
  matches: 'bg-section-matches-subtle text-section-matches-fg border-section-matches-border',
  'super-admins':
    'bg-section-super-admins-subtle text-section-super-admins-fg border-section-super-admins-border',
  audit: 'bg-section-audit-subtle text-section-audit-fg border-section-audit-border',
};

const navActiveClasses: Record<SectionAccentId, string> = {
  brand:
    'bg-section-brand-subtle text-section-brand-fg border-l-[3px] border-section-brand-fg font-semibold',
  plans:
    'bg-section-plans-subtle text-section-plans-fg border-l-[3px] border-section-plans-fg font-semibold',
  academies:
    'bg-section-academies-subtle text-section-academies-fg border-l-[3px] border-section-academies-fg font-semibold',
  users:
    'bg-section-users-subtle text-section-users-fg border-l-[3px] border-section-users-fg font-semibold',
  billing:
    'bg-section-billing-subtle text-section-billing-fg border-l-[3px] border-section-billing-fg font-semibold',
  matches:
    'bg-section-matches-subtle text-section-matches-fg border-l-[3px] border-section-matches-fg font-semibold',
  'super-admins':
    'bg-section-super-admins-subtle text-section-super-admins-fg border-l-[3px] border-section-super-admins-fg font-semibold',
  audit:
    'bg-section-audit-subtle text-section-audit-fg border-l-[3px] border-section-audit-fg font-semibold',
};

const quickLinkClasses: Record<SectionAccentId, string> = {
  brand: 'border-l-[3px] border-section-brand-fg hover:bg-section-brand-subtle',
  plans: 'border-l-[3px] border-section-plans-fg hover:bg-section-plans-subtle',
  academies: 'border-l-[3px] border-section-academies-fg hover:bg-section-academies-subtle',
  users: 'border-l-[3px] border-section-users-fg hover:bg-section-users-subtle',
  billing: 'border-l-[3px] border-section-billing-fg hover:bg-section-billing-subtle',
  matches: 'border-l-[3px] border-section-matches-fg hover:bg-section-matches-subtle',
  'super-admins':
    'border-l-[3px] border-section-super-admins-fg hover:bg-section-super-admins-subtle',
  audit: 'border-l-[3px] border-section-audit-fg hover:bg-section-audit-subtle',
};

export function sectionStatCardClasses(accent: SectionAccentId): { card: string; icon: string } {
  return statCardClasses[accent];
}

export function sectionBadgeClasses(accent: SectionAccentId): string {
  return badgeClasses[accent];
}

export function sectionModuleHeaderClasses(accent: SectionAccentId): string {
  return `ds-module-header ds-module-header--${accent}`;
}

export function sectionNavActiveClasses(accent: SectionAccentId): string {
  return navActiveClasses[accent];
}

export function sectionQuickLinkClasses(accent: SectionAccentId): string {
  return quickLinkClasses[accent];
}

/** Resuelve acento desde id de navegación del panel */
export function sectionAccentFromNavId(navId: string): SectionAccentId {
  const map: Record<string, SectionAccentId> = {
    home: 'brand',
    plans: 'plans',
    academies: 'academies',
    billing: 'billing',
    users: 'users',
    categories: 'academies',
    players: 'plans',
    matches: 'matches',
    actions: 'matches',
    children: 'users',
    calendar: 'matches',
    'super-admins': 'super-admins',
    audit: 'audit',
    reports: 'audit',
    settings: 'brand',
  };
  return map[navId] ?? 'brand';
}
