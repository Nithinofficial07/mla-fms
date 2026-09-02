import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import {
  buildReport, toCsv, toPdf, toXlsx, type ReportKey,
} from './reports.service.js';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.REPORT_VIEW));

const KEYS: ReportKey[] = [
  'department', 'ward', 'gram-panchayat', 'village',
  'status', 'priority', 'monthly', 'officer', 'pending', 'overdue',
];

const querySchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json'),
  from: z.string().optional(),
  to: z.string().optional(),
  departmentId: z.string().length(24).optional(),
  wardId: z.string().length(24).optional(),
  gramPanchayatId: z.string().length(24).optional(),
  villageId: z.string().length(24).optional(),
  statusCode: z.string().optional(),
  priorityId: z.string().length(24).optional(),
});

router.get('/', (_req, res) => res.json({ reports: KEYS }));

router.get(
  '/:key',
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const key = req.params.key as ReportKey;
    if (!KEYS.includes(key)) return res.status(404).json({ message: 'Unknown report', code: 'NOT_FOUND' });
    const { format, ...filters } = req.query as z.infer<typeof querySchema>;
    const { columns, rows } = await buildReport(key, filters);
    const title = `${key} report`;

    if (format === 'json') return ok(res, { key, columns, rows, generatedAt: new Date().toISOString() });

    recordAudit(req, { action: 'CREATE', entity: 'Report', entityId: key, message: `export ${format}` });
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${key}-report.csv"`);
      return res.send(toCsv(columns, rows));
    }
    if (format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${key}-report.xlsx"`);
      return res.send(await toXlsx(title, columns, rows));
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${key}-report.pdf"`);
    return res.send(await toPdf(title, columns, rows));
  }),
);

export default router;
