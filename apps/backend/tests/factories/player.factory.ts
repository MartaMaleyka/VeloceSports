import { randomUUID } from 'crypto';

export interface PlayerFactoryData {
  id?: string;
  tenantId?: number;
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
  position?: string;
  jerseyNumber?: number;
  photoUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createPlayer(overrides: PlayerFactoryData = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    tenantId: overrides.tenantId ?? 1,
    firstName: overrides.firstName ?? 'John',
    lastName: overrides.lastName ?? `Player-${randomUUID().slice(0, 8)}`,
    birthDate: overrides.birthDate ?? new Date('2010-01-01'),
    position: overrides.position ?? 'Forward',
    jerseyNumber: overrides.jerseyNumber ?? Math.floor(Math.random() * 99) + 1,
    photoUrl: overrides.photoUrl === null ? null : overrides.photoUrl ?? `https://example.com/photos/${randomUUID()}.jpg`,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function createPlayers(count: number, overrides: PlayerFactoryData = {}) {
  return Array.from({ length: count }, (_, i) =>
    createPlayer({
      ...overrides,
      jerseyNumber: overrides.jerseyNumber ?? i + 1,
    })
  );
}
