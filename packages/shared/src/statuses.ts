export const AcademyStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INACTIVE: 'inactive',
} as const;

export type AcademyStatus = (typeof AcademyStatus)[keyof typeof AcademyStatus];

export const AcademySuspensionReason = {
  BILLING: 'billing',
  MANUAL: 'manual',
} as const;

export type AcademySuspensionReason =
  (typeof AcademySuspensionReason)[keyof typeof AcademySuspensionReason];

/** `personal`: cuenta autogestionada de un padre sin academia (un solo jugador). */
export const AcademyAccountType = {
  ACADEMY: 'academy',
  PERSONAL: 'personal',
} as const;

export type AcademyAccountType = (typeof AcademyAccountType)[keyof typeof AcademyAccountType];

/** Solo aplica a cuentas `personal`: las academias reales nacen ya `approved`. */
export const AcademyApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type AcademyApprovalStatus =
  (typeof AcademyApprovalStatus)[keyof typeof AcademyApprovalStatus];

export const MatchStatus = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const PlayerStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  INJURED: 'injured',
  RETIRED: 'retired',
} as const;

export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];

export const ActionImpact = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
} as const;

export type ActionImpact = (typeof ActionImpact)[keyof typeof ActionImpact];
