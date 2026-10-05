import 'express';
import type { Permission } from '@mla/shared';

declare global {
  namespace Express {
    interface AuthContext {
      userId: string;
      name: string;
      roleCode: string;
      permissions: Permission[];
      departmentId: string | null;
      principalIds: string[];
      /** True only for a PRINCIPAL_ALL_VIEW user who hasn't narrowed to one principal via X-Principal-Id - skip principalId filtering entirely. */
      viewAllPrincipals: boolean;
    }
    interface Request {
      auth?: AuthContext;
      id?: string;
    }
  }
}

export {};
