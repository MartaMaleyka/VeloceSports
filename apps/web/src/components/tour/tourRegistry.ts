import type { TourDefinition } from './types';
import type { DashboardContentKey } from '../../lib/navigation';
import { superAdminTours } from './definitions/superAdmin.tour';
import { academyAdminTours } from './definitions/academyAdmin.tour';
import { coachTours } from './definitions/coach.tour';
import { parentTours } from './definitions/parent.tour';
import { playerTours } from './definitions/player.tour';

const registries: Record<DashboardContentKey, Partial<Record<string, TourDefinition>>> = {
  superAdmin: superAdminTours,
  academyAdmin: academyAdminTours,
  coach: coachTours,
  parent: parentTours,
  player: playerTours,
};

export function getTourDefinition(
  contentKey: DashboardContentKey,
  pageId: string | undefined,
): TourDefinition | null {
  if (!pageId) return null;
  const steps = registries[contentKey]?.[pageId];
  return steps && steps.length > 0 ? steps : null;
}

export function getTourKey(contentKey: DashboardContentKey, pageId: string): string {
  return `${contentKey}:${pageId}`;
}
