import { Router } from 'express';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { upload } from '../../middleware/upload.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { LocationImportJob } from '../../models/LocationImportJob.js';
import {
  buildTemplate, importDepartments, importLocations,
} from './import.service.js';

const router = Router();
router.use(authenticate);

/** GET /api/imports/template?kind=LOCATION|DEPARTMENT */
router.get(
  '/template',
  requirePermission(PERMISSIONS.LOCATION_MANAGE),
  asyncHandler(async (req, res) => {
    const kind = req.query.kind === 'DEPARTMENT' ? 'DEPARTMENT' : 'LOCATION';
    const buf = await buildTemplate(kind);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${kind.toLowerCase()}_template.xlsx"`);
    res.send(buf);
  }),
);

/**
 * POST /api/imports/locations   (multipart: file, ?dryRun=true|false)
 * Always validates; commits only when dryRun=false. Returns the report and
 * persists a LocationImportJob so admins can review past imports.
 */
router.post(
  '/locations',
  requirePermission(PERMISSIONS.LOCATION_MANAGE),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Spreadsheet file is required');
    const dryRun = req.query.dryRun !== 'false';
    const report = await importLocations(req.file.buffer, { dryRun, createdBy: req.auth!.userId });
    const job = await LocationImportJob.create({
      kind: 'LOCATION',
      fileName: req.file.originalname,
      status: report.errors.length && !dryRun ? 'failed' : dryRun ? 'validated' : 'imported',
      totalRows: report.totalRows,
      validRows: report.validRows,
      createdCount: report.createdCount,
      errors: report.errors,
      dryRun,
      createdBy: req.auth!.userId,
    });
    if (!dryRun) recordAudit(req, { action: 'IMPORT', entity: 'Location', entityId: String(job._id), after: report });
    ok(res, { job, report });
  }),
);

router.post(
  '/departments',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Spreadsheet file is required');
    const dryRun = req.query.dryRun !== 'false';
    const report = await importDepartments(req.file.buffer, { dryRun });
    const job = await LocationImportJob.create({
      kind: 'DEPARTMENT',
      fileName: req.file.originalname,
      status: dryRun ? 'validated' : 'imported',
      totalRows: report.totalRows,
      validRows: report.validRows,
      createdCount: report.createdCount,
      errors: report.errors,
      dryRun,
      createdBy: req.auth!.userId,
    });
    if (!dryRun) recordAudit(req, { action: 'IMPORT', entity: 'Department', entityId: String(job._id), after: report });
    ok(res, { job, report });
  }),
);

router.get(
  '/jobs',
  requirePermission(PERMISSIONS.LOCATION_MANAGE),
  asyncHandler(async (_req, res) =>
    ok(res, await LocationImportJob.find().sort('-createdAt').limit(50).lean()),
  ),
);

export default router;
