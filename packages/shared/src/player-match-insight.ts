export type PlayerMatchInsightSource = 'ollama' | 'fallback';
export type PlayerMatchInsightStatus = 'ready' | 'pending';

export interface PlayerMatchInsightDto {
  status: PlayerMatchInsightStatus;
  text: string | null;
  generationSource: PlayerMatchInsightSource | null;
  generatedAt: string | null;
  hasEnoughData: boolean | null;
}

export interface RegenerateInsightBody {
  forceRegenerate?: boolean;
  locale?: 'es' | 'en';
}
