export type PlayerMatchInsightSource = 'ollama' | 'fallback';

export interface PlayerMatchInsightDto {
  text: string;
  generationSource: PlayerMatchInsightSource;
  generatedAt: string;
  hasEnoughData: boolean;
}

export interface RegenerateInsightBody {
  forceRegenerate?: boolean;
}
