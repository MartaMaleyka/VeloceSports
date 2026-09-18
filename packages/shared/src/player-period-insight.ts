import type { PlayerMatchInsightSource, PlayerMatchInsightStatus } from './player-match-insight.js';

export interface PlayerPeriodInsightDto {
  status: PlayerMatchInsightStatus;
  text: string | null;
  generationSource: PlayerMatchInsightSource | null;
  generatedAt: string | null;
  hasEnoughData: boolean | null;
}

export interface RegeneratePeriodInsightBody {
  forceRegenerate?: boolean;
  locale?: 'es' | 'en';
}
