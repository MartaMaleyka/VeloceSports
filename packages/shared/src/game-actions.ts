import type { ActionImpact } from './statuses.js';

export const GameActionStatus = {
  ACTIVE: 'active',
  VOIDED: 'voided',
} as const;

export type GameActionStatus = (typeof GameActionStatus)[keyof typeof GameActionStatus];

export interface GameActionDto {
  id: number;
  matchId: number;
  playerId: number;
  actionCatalogId: number;
  actionCode: number;
  actionName: string;
  actionImpact: ActionImpact;
  actionNotifiable: boolean;
  matchJerseyNumber: number;
  minute: number;
  period: number;
  status: GameActionStatus;
  clientActionId: string;
  createdBy: number;
  createdAt: string;
  voidedBy: number | null;
  voidedAt: string | null;
  voidReason: string | null;
  /** true = agregada en corrección post-partido (no captura en vivo) */
  addedPostMatch: boolean;
}

export interface GameActionStatsDto {
  /** Solo acciones vigentes (RN-17) */
  totalActive: number;
  byActionCode: Record<string, number>;
}

export interface GameActionListDto {
  actions: GameActionDto[];
  stats: GameActionStatsDto;
}

export interface CreateGameActionBody {
  /** UUID v4 generado en el cliente — idempotencia optimista */
  clientActionId: string;
  playerId: number;
  actionCode: number;
  minute: number;
  period: number;
}

export interface VoidGameActionBody {
  reason?: string | null;
}
