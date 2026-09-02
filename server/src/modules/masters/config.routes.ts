import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { RequestCategory, RequestStatus, Priority, Lookup } from '../../models/config.js';
import { crudRouter } from '../../utils/crudFactory.js';

/** /api/request-categories */
export const categoryRouter = crudRouter({
  model: RequestCategory,
  entity: 'RequestCategory',
  createSchema: z.object({
    name: z.string().min(2),
    code: z.string().optional(),
    description: z.string().optional(),
    order: z.number().int().optional(),
  }),
  updateSchema: z
    .object({
      name: z.string().min(2),
      code: z.string(),
      description: z.string(),
      order: z.number().int(),
      isActive: z.boolean(),
    })
    .partial(),
  permissions: { read: PERMISSIONS.DASHBOARD_VIEW, write: PERMISSIONS.CATEGORY_MANAGE },
  searchFields: ['name', 'code'],
});

/** /api/request-statuses */
export const statusRouter = crudRouter({
  model: RequestStatus,
  entity: 'RequestStatus',
  createSchema: z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    order: z.number().int().optional(),
    color: z.string().optional(),
    isInitial: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    transitionsTo: z.array(z.string()).optional(),
  }),
  updateSchema: z
    .object({
      name: z.string().min(2),
      order: z.number().int(),
      color: z.string(),
      isInitial: z.boolean(),
      isTerminal: z.boolean(),
      transitionsTo: z.array(z.string()),
      isActive: z.boolean(),
    })
    .partial(),
  permissions: { read: PERMISSIONS.DASHBOARD_VIEW, write: PERMISSIONS.STATUS_MANAGE },
  searchFields: ['name', 'code'],
});

/** /api/priorities */
export const priorityRouter = crudRouter({
  model: Priority,
  entity: 'Priority',
  createSchema: z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    slaDays: z.number().int().min(0).optional(),
    color: z.string().optional(),
    order: z.number().int().optional(),
  }),
  updateSchema: z
    .object({
      name: z.string().min(2),
      slaDays: z.number().int().min(0),
      color: z.string(),
      order: z.number().int(),
      isActive: z.boolean(),
    })
    .partial(),
  permissions: { read: PERMISSIONS.DASHBOARD_VIEW, write: PERMISSIONS.STATUS_MANAGE },
  searchFields: ['name', 'code'],
});

/** /api/lookups?group=DOCUMENT_TYPE|REQUEST_TYPE|ID_TYPE */
export const lookupRouter = crudRouter({
  model: Lookup,
  entity: 'Lookup',
  createSchema: z.object({
    group: z.enum(['REQUEST_TYPE', 'DOCUMENT_TYPE', 'ID_TYPE']),
    name: z.string().min(1),
    order: z.number().int().optional(),
  }),
  updateSchema: z.object({ name: z.string().min(1), order: z.number().int(), isActive: z.boolean() }).partial(),
  permissions: { read: PERMISSIONS.DASHBOARD_VIEW, write: PERMISSIONS.SETTINGS_MANAGE },
  searchFields: ['name'],
  filterFields: ['group'],
});

/** Aggregates the config routers so index.ts mounts them under stable paths. */
export function mountConfigRouters(parent: Router): void {
  parent.use('/request-categories', categoryRouter);
  parent.use('/request-statuses', statusRouter);
  parent.use('/priorities', priorityRouter);
  parent.use('/lookups', lookupRouter);
}
