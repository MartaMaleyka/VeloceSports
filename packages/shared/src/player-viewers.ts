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
