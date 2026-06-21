import type { UserRole } from '@velocesport/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: UserRole;
        tenantId: number | null;
      };
      tenantId?: number;
    }
  }
}

export {};
