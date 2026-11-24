import type { Role } from '@effort-tracker/shared';
declare global {
  namespace Express {
    interface Request {
      access?: { organizationId: string; portfolioId: string; projectId: string; role: Role; memberId: string; memberName: string; memberEmail: string; adminVerified: boolean; sessionExpiresAt: number };
    }
  }
}
export {};
