import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@mla/shared';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import { asyncHandler, created, noContent, ok } from '../../utils/http.js';
import { withId } from '../../utils/queryFeatures.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { LocalProvider } from '../../storage/index.js';
import { RequestModel } from '../../models/Request.js';
import { Letter } from '../../models/Letter.js';
import { addTimeline } from '../workflow/timeline.service.js';
import { notifyUsers } from '../notifications/notify.js';
import { documentsService, type DocOwner } from './documents.service.js';

const router = Router();

/**
 * GET /api/documents/raw?key=&exp=&sig=[&download=1]
 * Serves a locally-stored object after verifying the HMAC signed-URL token.
 * (S3 provider hands the browser a presigned S3 URL directly and never hits this.)
 * Public route by design - the token IS the authorization - but rejects expired/forged tokens.
 */
router.get(
  '/raw',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const key = String(req.query.key ?? '');
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    if (!key || !LocalProvider.verify(key, exp, sig)) throw AppError.forbidden('Invalid or expired link');
    const { storage } = await import('../../storage/index.js');
    const buf = await storage().getBuffer(key).catch(() => {
      throw AppError.notFound('File not found');
    });
    const name = req.query.filename ? String(req.query.filename) : key.split('/').pop();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${req.query.download ? 'attachment' : 'inline'}; filename="${name}"`,
    );
    res.send(buf);
  }),
);

router.use(authenticate);

/* ------------------------------------------------------------------ */
/* Shared upload / scan handlers, parametrised by owner (request|letter) */
/* ------------------------------------------------------------------ */

async function ownerLabel(owner: DocOwner): Promise<{ label: string; link: string; notify: string[] }> {
  if (owner.kind === 'request') {
    const r = await RequestModel.findById(owner.id).lean();
    if (!r) throw AppError.notFound('Request not found');
    return {
      label: r.fileId,
      link: `/requests/${owner.id}`,
      notify: [r.assignedOfficerId ? String(r.assignedOfficerId) : ''].filter(Boolean),
    };
  }
  const l = await Letter.findById(owner.id).lean();
  if (!l) throw AppError.notFound('Letter not found');
  return { label: l.letterNo, link: `/letters/${owner.id}`, notify: [String(l.createdBy)] };
}

async function handleUpload(owner: DocOwner, req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw AppError.badRequest('At least one file is required');
  const meta = await ownerLabel(owner);

  const docs = [];
  for (const f of files) {
    const doc = await documentsService.addDocument({
      owner,
      documentType: req.body.documentType,
      description: req.body.description,
      originalName: f.originalname,
      mimeType: f.mimetype,
      buffer: f.buffer,
      uploadedBy: req.auth!.userId,
      source: 'upload',
    });
    docs.push(doc);
    recordAudit(req, { action: 'DOCUMENT_UPLOAD', entity: 'Document', entityId: String(doc._id), after: { documentId: doc.documentId } });
  }
  if (owner.kind === 'request') {
    await addTimeline({
      requestId: owner.id, action: 'DOCUMENT_UPLOADED',
      label: `${docs.length} document(s) uploaded`, actorId: req.auth!.userId, actorName: req.auth!.name,
      attachments: docs.map((d) => String(d._id)),
    });
  }
  await notifyUsers(meta.notify, {
    type: 'DOCUMENT_UPLOADED', title: `Document(s) added to ${meta.label}`, link: meta.link,
  });
  created(res, docs);
}

async function handleScan(owner: DocOwner, req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('Scanned PDF is required');
  if (req.file.mimetype !== 'application/pdf') throw AppError.badRequest('Scan must be a generated PDF');
  await ownerLabel(owner); // 404 if owner missing
  const doc = await documentsService.addDocument({
    owner,
    documentType: req.body.documentType,
    description: req.body.description,
    originalName: req.file.originalname || `scan-${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    buffer: req.file.buffer,
    uploadedBy: req.auth!.userId,
    source: 'scan',
    pageCount: req.body.pageCount ?? 1,
  });
  if (owner.kind === 'request') {
    await addTimeline({
      requestId: owner.id, action: 'DOCUMENT_SCAN', label: `Scanned document added (${doc.pageCount} page(s))`,
      actorId: req.auth!.userId, actorName: req.auth!.name, attachments: [String(doc._id)],
    });
  }
  recordAudit(req, { action: 'DOCUMENT_SCAN', entity: 'Document', entityId: String(doc._id) });
  created(res, doc);
}

const uploadBody = z.object({ documentType: z.string().min(1), description: z.string().optional() });
const scanBody = uploadBody.extend({ pageCount: z.coerce.number().int().min(1).optional() });

/* ----------------------------- request docs ----------------------------- */
router.get(
  '/request/:requestId',
  requirePermission(PERMISSIONS.DOCUMENT_VIEW),
  asyncHandler(async (req, res) =>
    ok(res, withId(await documentsService.listForOwner({ kind: 'request', id: req.params.requestId }))),
  ),
);
router.post(
  '/request/:requestId',
  requirePermission(PERMISSIONS.DOCUMENT_UPLOAD),
  upload.array('files', 20),
  validate({ body: uploadBody }),
  asyncHandler((req, res) => handleUpload({ kind: 'request', id: req.params.requestId }, req, res)),
);
router.post(
  '/request/:requestId/scan',
  requirePermission(PERMISSIONS.DOCUMENT_UPLOAD),
  upload.single('file'),
  validate({ body: scanBody }),
  asyncHandler((req, res) => handleScan({ kind: 'request', id: req.params.requestId }, req, res)),
);

/* ------------------------------ letter docs ---------------------------- */
router.get(
  '/letter/:letterId',
  requirePermission(PERMISSIONS.DOCUMENT_VIEW),
  asyncHandler(async (req, res) =>
    ok(res, withId(await documentsService.listForOwner({ kind: 'letter', id: req.params.letterId }))),
  ),
);
router.post(
  '/letter/:letterId',
  requirePermission(PERMISSIONS.DOCUMENT_UPLOAD),
  upload.array('files', 20),
  validate({ body: uploadBody }),
  asyncHandler((req, res) => handleUpload({ kind: 'letter', id: req.params.letterId }, req, res)),
);
router.post(
  '/letter/:letterId/scan',
  requirePermission(PERMISSIONS.DOCUMENT_UPLOAD),
  upload.single('file'),
  validate({ body: scanBody }),
  asyncHandler((req, res) => handleScan({ kind: 'letter', id: req.params.letterId }, req, res)),
);

/* --------------------------- shared by id ----------------------------- */
router.post(
  '/:id/versions',
  requirePermission(PERMISSIONS.DOCUMENT_UPLOAD),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('File is required');
    const doc = await documentsService.addVersion(req.params.id, {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      uploadedBy: req.auth!.userId,
      source: 'upload',
    });
    recordAudit(req, { action: 'DOCUMENT_UPLOAD', entity: 'Document', entityId: req.params.id, message: `v${doc.currentVersion}` });
    ok(res, doc);
  }),
);

router.get(
  '/:id/url',
  requirePermission(PERMISSIONS.DOCUMENT_VIEW),
  asyncHandler(async (req, res) => {
    const result = await documentsService.signedUrlFor(req.params.id, { download: req.query.download === '1' });
    if (req.query.download === '1') {
      recordAudit(req, { action: 'DOCUMENT_DOWNLOAD', entity: 'Document', entityId: req.params.id });
    }
    ok(res, result);
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DOCUMENT_DELETE),
  asyncHandler(async (req, res) => {
    await documentsService.remove(req.params.id);
    recordAudit(req, { action: 'DOCUMENT_DELETE', entity: 'Document', entityId: req.params.id });
    noContent(res);
  }),
);

export default router;
