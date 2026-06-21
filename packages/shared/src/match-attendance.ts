export const MatchLineupRole = {
  STARTER: 'starter',
  SUBSTITUTE: 'substitute',
} as const;

export type MatchLineupRole = (typeof MatchLineupRole)[keyof typeof MatchLineupRole];

export const MATCH_LINEUP_ROLES = [
  MatchLineupRole.STARTER,
  MatchLineupRole.SUBSTITUTE,
] as const satisfies readonly MatchLineupRole[];

export interface MatchAttendanceEntryDto {
  playerId: number;
  playerFirstName: string;
  playerLastName: string;
  playerStatus: string;
  defaultJerseyNumber: number;
  attended: boolean;
  lineup: MatchLineupRole | null;
  matchJerseyNumber: number | null;
  attendanceId: number | null;
}

export interface MatchAttendanceSummaryDto {
  presentCount: number;
  starterCount: number;
  substituteCount: number;
}

export interface MatchAttendanceDto {
  matchId: number;
  canEdit: boolean;
  editable: boolean;
  categoryId: number;
  categoryName: string;
  summary: MatchAttendanceSummaryDto;
  entries: MatchAttendanceEntryDto[];
}

export interface SaveMatchAttendanceEntryBody {
  playerId: number;
  attended: boolean;
  lineup?: MatchLineupRole | null;
  matchJerseyNumber?: number | null;
}

export interface SaveMatchAttendanceBody {
  entries: SaveMatchAttendanceEntryBody[];
}
