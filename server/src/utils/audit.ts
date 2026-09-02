import type { Request } from 'express';
import type { AuditAction } from '@mla/shared';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

export interface AuditInput {
  action: AuditAction | string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  message?: string;
}

/**
 * Fire-and-forget audit writer. Never throws into the request path -
 * a failed audit write is logged but must not break the user action.
 */
export function recordAudit(req: Request, input: AuditInput): void {
  const actor = req.auth;
  AuditLog.create({
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? undefined,
    actorId: actor?.userId ?? undefined,
    actorName: actor?.name ?? 'system',
    actorRole: actor?.roleCode ?? undefined,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    before: input.before,
    after: input.after,
    message: input.message,
  }).catch((err) => logger.error({ err }, 'audit write failed'));
}
