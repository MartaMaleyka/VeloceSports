import type { MatchType } from '@velocesport/shared';

export interface MatchFormState {
  categoryId: string;
  opponent: string;
  matchDatetime: string;
  location: string;
  matchType: MatchType;
  notes: string;
}
