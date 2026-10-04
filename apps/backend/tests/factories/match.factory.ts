import { randomUUID } from 'crypto';

export interface MatchFactoryData {
  id?: string;
  tenantId?: number;
  coachId?: string;
  opponent?: string;
  date?: Date;
  location?: string;
  result?: 'Win' | 'Draw' | 'Loss' | null;
  scoreFor?: number;
  scoreAgainst?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createMatch(overrides: MatchFactoryData = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    tenantId: overrides.tenantId ?? 1,
    coachId: overrides.coachId ?? randomUUID(),
    opponent: overrides.opponent ?? 'Opponent FC',
    date: overrides.date ?? new Date(),
    location: overrides.location ?? 'Stadium A',
    result: overrides.result ?? 'Win',
    scoreFor: overrides.scoreFor ?? 3,
    scoreAgainst: overrides.scoreAgainst ?? 1,
    notes: overrides.notes ?? 'Great match',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function createMatches(count: number, overrides: MatchFactoryData = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMatch({
      ...overrides,
      opponent: overrides.opponent ?? `Opponent ${i + 1}`,
      date: overrides.date ? new Date(overrides.date.getTime() + i * 24 * 60 * 60 * 1000) : new Date(),
    })
  );
}
