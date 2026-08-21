/**
 * requires_guardian efectivo de una categoría:
 *   requiresGuardian ?? (ageMax == null || ageMax < 18)
 *
 * Fuente única para backend (gate invite-adult) y frontend (visibilidad del toggle).
 */
export function resolveRequiresGuardian(input: {
  requiresGuardian: number | boolean | null;
  ageMax: number | null;
}): boolean {
  if (input.requiresGuardian !== null && input.requiresGuardian !== undefined) {
    return Boolean(Number(input.requiresGuardian));
  }
  return input.ageMax == null || input.ageMax < 18;
}

/** Relación viewer↔jugador en `player_viewers`. */
export const ViewerRelationship = {
  PARENT: 'PARENT',
  SELF: 'SELF',
  GUARDIAN: 'GUARDIAN',
  MANAGER: 'MANAGER',
} as const;

export type ViewerRelationship = (typeof ViewerRelationship)[keyof typeof ViewerRelationship];

export interface InviteAdultPlayerBody {
  email: string;
  /** Si se omite, se usan first_name/last_name del jugador. */
  firstName?: string;
  lastName?: string;
}

export interface InviteAdultPlayerResponseDto {
  userId: number;
  playerId: number;
  email: string;
  temporaryPassword: string;
  mustChangePassword: true;
}
