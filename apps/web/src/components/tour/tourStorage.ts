import { getClientCookie, setClientCookie } from '@velocesport/i18n';

function cookieName(userId: number): string {
  return `vs_tours_seen_${userId}`;
}

function readSeen(userId: number): Set<string> {
  const raw = getClientCookie(cookieName(userId));
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function hasSeenTour(userId: number, tourKey: string): boolean {
  return readSeen(userId).has(tourKey);
}

export function markTourSeen(userId: number, tourKey: string): void {
  const seen = readSeen(userId);
  if (seen.has(tourKey)) return;
  seen.add(tourKey);
  setClientCookie(cookieName(userId), JSON.stringify([...seen]));
}
