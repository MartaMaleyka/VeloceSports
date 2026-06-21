export type ReportLocale = 'es' | 'en';

const labels = {
  es: {
    reports: {
      players: 'Jugadores',
      users: 'Usuarios',
      categories: 'Categorías',
      matches: 'Partidos',
      generatedAt: 'Generado el',
      page: 'Página',
      of: 'de',
      footer: 'VeloceSport — Reporte confidencial de la academia',
    },
    players: {
      name: 'Nombre',
      dateOfBirth: 'Fecha de nacimiento',
      category: 'Categoría',
      status: 'Estado',
      jersey: 'Camiseta',
      position: 'Posición',
      parents: 'Padres vinculados',
    },
    users: {
      name: 'Nombre',
      email: 'Email',
      role: 'Rol',
      status: 'Estado',
      lastLogin: 'Último acceso',
    },
    categories: {
      name: 'Nombre',
      ageRange: 'Rango de edad',
      coach: 'Entrenador',
      playerCount: 'Nº jugadores',
      status: 'Estado',
    },
    matches: {
      opponent: 'Rival',
      category: 'Categoría',
      datetime: 'Fecha y hora',
      type: 'Tipo',
      status: 'Estado',
    },
    status: {
      active: 'Activo',
      inactive: 'Inactivo',
      pending: 'Pendiente',
      injured: 'Lesionado',
      retired: 'Retirado',
      scheduled: 'Programado',
      in_progress: 'En curso',
      finished: 'Finalizado',
      cancelled: 'Cancelado',
    },
    roles: {
      academy_admin: 'Administrador',
      coach: 'Entrenador',
      parent: 'Padre / acudiente',
    },
    matchType: {
      league: 'Liga',
      friendly: 'Amistoso',
      tournament: 'Torneo',
    },
    common: {
      none: '—',
      never: 'Nunca',
    },
  },
  en: {
    reports: {
      players: 'Players',
      users: 'Users',
      categories: 'Categories',
      matches: 'Matches',
      generatedAt: 'Generated on',
      page: 'Page',
      of: 'of',
      footer: 'VeloceSport — Confidential academy report',
    },
    players: {
      name: 'Name',
      dateOfBirth: 'Date of birth',
      category: 'Category',
      status: 'Status',
      jersey: 'Jersey',
      position: 'Position',
      parents: 'Linked parents',
    },
    users: {
      name: 'Name',
      email: 'Email',
      role: 'Role',
      status: 'Status',
      lastLogin: 'Last login',
    },
    categories: {
      name: 'Name',
      ageRange: 'Age range',
      coach: 'Coach',
      playerCount: 'Players',
      status: 'Status',
    },
    matches: {
      opponent: 'Opponent',
      category: 'Category',
      datetime: 'Date & time',
      type: 'Type',
      status: 'Status',
    },
    status: {
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      injured: 'Injured',
      retired: 'Retired',
      scheduled: 'Scheduled',
      in_progress: 'In progress',
      finished: 'Finished',
      cancelled: 'Cancelled',
    },
    roles: {
      academy_admin: 'Administrator',
      coach: 'Coach',
      parent: 'Parent / guardian',
    },
    matchType: {
      league: 'League',
      friendly: 'Friendly',
      tournament: 'Tournament',
    },
    common: {
      none: '—',
      never: 'Never',
    },
  },
} as const;

export function resolveReportLocale(input?: string | null): ReportLocale {
  if (!input) return 'es';
  const lower = input.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  return 'es';
}

export function getReportLabels(locale: ReportLocale) {
  return labels[locale];
}

export function reportTitle(locale: ReportLocale, reportType: string): string {
  const L = labels[locale].reports;
  const map: Record<string, string> = {
    players: L.players,
    users: L.users,
    categories: L.categories,
    matches: L.matches,
  };
  return map[reportType] ?? reportType;
}
