import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import setupRoutes from '../modules/setup/setup.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import roleRoutes from '../modules/masters/role.routes.js';
import departmentRoutes from '../modules/masters/department.routes.js';
import importRoutes from '../modules/masters/import.routes.js';
import {
  areaTypeRouter, constituencyRouter, gramPanchayatRouter,
  locationOptionsRouter, subVillageRouter, villageRouter, wardRouter,
} from '../modules/masters/location.routes.js';
import { mountConfigRouters } from '../modules/masters/config.routes.js';
import requestsRoutes from '../modules/requests/requests.routes.js';
import coverRoutes from '../modules/requests/cover.routes.js';
import lettersRoutes from '../modules/letters/letters.routes.js';
import documentsRoutes from '../modules/documents/documents.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';

export const api = Router();

api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

api.use('/auth', authRoutes);
api.use('/setup', setupRoutes);
api.use('/users', usersRoutes);
api.use('/roles', roleRoutes);
api.use('/departments', departmentRoutes);
api.use('/imports', importRoutes);

api.use('/constituencies', constituencyRouter);
api.use('/area-types', areaTypeRouter);
api.use('/wards', wardRouter);
api.use('/gram-panchayats', gramPanchayatRouter);
api.use('/villages', villageRouter);
api.use('/sub-villages', subVillageRouter);
api.use('/location-options', locationOptionsRouter);

mountConfigRouters(api);

// cover/resolve must be registered before the parametric requests router
api.use('/requests', coverRoutes);
api.use('/requests', requestsRoutes);
api.use('/letters', lettersRoutes);
api.use('/documents', documentsRoutes);
api.use('/notifications', notificationsRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/reports', reportsRoutes);
api.use('/audit-logs', auditRoutes);
api.use('/settings', settingsRoutes);
