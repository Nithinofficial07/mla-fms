import { Router } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { makeQrToken, qrTargetUrl, readQrToken } from '../../utils/qrToken.js';
import { requestsService } from './requests.service.js';
import { DocumentModel } from '../../models/Document.js';
import { listTimeline } from '../workflow/timeline.service.js';

/**
 * Mounted at /api/requests BEFORE the main router so `/resolve/:token`
 * and `/:id/cover.pdf` are matched ahead of the `/:id` param route.
 */
const router = Router();
router.use(authenticate);

/** Resolve a scanned QR token -> request id (for the SPA redirect). */
router.get(
  '/resolve/:token',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  asyncHandler(async (req, res) => {
    try {
      const id = readQrToken(req.params.token);
      const doc = await requestsService.getDetail(id);
      ok(res, { id, fileId: (doc as { fileId: string }).fileId });
    } catch {
      throw AppError.badRequest('Invalid or expired QR code');
    }
  }),
);

/** Printable A4 file cover with a QR that encodes only a signed reference. */
router.get(
  '/:id/cover.pdf',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  asyncHandler(async (req, res) => {
    const r = (await requestsService.getDetail(req.params.id)) as any;
    const [docs, timeline] = await Promise.all([
      DocumentModel.find({ requestId: req.params.id }).lean(),
      listTimeline(req.params.id),
    ]);
    const token = makeQrToken(req.params.id);
    const qrPng = await QRCode.toBuffer(qrTargetUrl(token), { width: 140, margin: 1 });

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="cover-${r.fileId.replace(/\W+/g, '-')}.pdf"`);
      res.send(Buffer.concat(chunks));
    });

    doc.fontSize(18).text('MLA OFFICE', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text('File Cover Sheet', { align: 'center' });
    doc.moveDown();
    doc.image(qrPng, doc.page.width - 48 - 140, 48, { width: 140 });

    doc.fillColor('#000').fontSize(11);
    const line = (k: string, v: unknown) => doc.text(`${k}:  `, { continued: true }).font('Helvetica-Bold').text(String(v ?? '-')).font('Helvetica');
    doc.font('Helvetica');
    line('File ID', r.fileId);
    line('Request ID', r.requestId);
    line('Applicant', r.applicant?.name);
    line('Mobile', r.applicant?.mobile);
    line('Subject', r.subject);
    line('Department', r.primaryDepartmentId?.name ?? 'Unassigned');
    line('Priority', r.priorityId?.name ?? '');
    line('Status', r.statusId?.name ?? r.statusCode);
    line('Created', new Date(r.createdAt).toLocaleString());
    line('Due date', r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'Not set');

    doc.moveDown().fontSize(13).text('Document Checklist');
    doc.fontSize(10);
    if (!docs.length) doc.text('  (no documents attached)');
    docs.forEach((d) => doc.text(`  [ ] ${d.documentType} - ${d.documentId} (${d.pageCount} page(s))`));

    doc.moveDown().fontSize(13).text('Timeline Summary');
    doc.fontSize(9);
    timeline.slice(0, 12).forEach((t: any) =>
      doc.text(`  ${new Date(t.createdAt).toLocaleString()}  -  ${t.label}`),
    );

    doc.moveDown(2).fontSize(10).text('Remarks / Signature:');
    doc.rect(doc.x, doc.y + 6, doc.page.width - 96, 90).stroke();

    doc.end();
  }),
);

export default router;
