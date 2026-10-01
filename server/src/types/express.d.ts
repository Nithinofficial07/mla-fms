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
    }
    interface Request {
      auth?: AuthContext;
      id?: string;
    }
  }
}

export {};
