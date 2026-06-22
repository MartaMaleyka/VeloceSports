export interface PlayerObservationDto {
  id: number;
  playerId: number;
  matchId: number | null;
  coachUserId: number;
  coachDisplayName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  matchOpponent: string | null;
  matchDatetime: string | null;
  /** Solo en respuestas del coach autenticado */
  isOwn?: boolean;
}

export interface CreatePlayerObservationBody {
  content: string;
  matchId?: number | null;
}

export interface UpdatePlayerObservationBody {
  content: string;
}

export interface ListPlayerObservationsQuery {
  matchId?: number;
}
