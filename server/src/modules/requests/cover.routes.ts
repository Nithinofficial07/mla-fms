import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

/* --------------------------- office portrait ----------------------------- */
// Optional office/MLA photo for the cover-sheet letterhead. Drop a JPG/PNG at
// server/src/assets/office-photo.jpg (any size - it's scaled to a 56x56
// circle) and `npm run build` copies it into dist/ automatically (see
// scripts/copy-assets.mjs). Renders without one - this is a nice-to-have,
// never a hard requirement.
const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets');
const OFFICE_PHOTO: Buffer | null = (() => {
  for (const name of ['office-photo.jpg', 'office-photo.jpeg', 'office-photo.png']) {
    try {
      return readFileSync(path.join(ASSET_DIR, name));
    } catch {
      /* try next extension */
    }
  }
  return null;
})();

/* ------------------------------- palette ---------------------------------- */
const NAVY = '#0B3450';
const GOLD = '#B8860B';
const INK = '#1A2233';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const PANEL = '#F4F5F7';

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
      listTimeline({ requestId: req.params.id }),
    ]);
    const token = makeQrToken(req.params.id);
    const qrPng = await QRCode.toBuffer(qrTargetUrl(token), { width: 200, margin: 1 });

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="cover-${r.fileId.replace(/\W+/g, '-')}.pdf"`);
      res.send(Buffer.concat(chunks));
    });

    const M = 48; // content margin
    const W = doc.page.width;
    const contentW = W - M * 2;

    /* ---- header band: navy fill + gold accent strip ---- */
    const headerH = 108;
    doc.rect(0, 0, W, headerH).fill(NAVY);
    doc.rect(0, headerH, W, 4).fill(GOLD);

    if (OFFICE_PHOTO) {
      const cx = M + 28;
      const cy = headerH / 2;
      doc.save();
      doc.circle(cx, cy, 28).clip();
      doc.image(OFFICE_PHOTO, cx - 28, cy - 28, { width: 56, height: 56 });
      doc.restore();
      doc.circle(cx, cy, 28).lineWidth(1.5).strokeColor(GOLD).stroke();
    }

    const titleX = OFFICE_PHOTO ? M + 68 : M;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('MLA OFFICE', titleX, 30);
    doc.font('Helvetica').fontSize(11).fillColor('#D9E2EC').text('File Cover Sheet', titleX, 56);

    // QR on a white plate so it scans reliably against the navy band.
    const qrSize = 84;
    const qrPlate = qrSize + 12;
    const qrX = W - M - qrPlate;
    const qrY = (headerH - qrPlate) / 2;
    doc.roundedRect(qrX, qrY, qrPlate, qrPlate, 6).fill('#FFFFFF');
    doc.image(qrPng, qrX + 6, qrY + 6, { width: qrSize, height: qrSize });

    let y = headerH + 4 + 24;

    /* ---- big File ID banner ---- */
    doc.roundedRect(M, y, contentW, 40, 6).fill(PANEL);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('FILE ID', M + 14, y + 8);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(r.fileId, M + 14, y + 19);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('STATUS', M + contentW - 160, y + 8, { width: 146, align: 'right' });
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text(r.statusId?.name ?? r.statusCode, M + contentW - 160, y + 21, { width: 146, align: 'right' });
    y += 40 + 22;

    /* ---- helpers ---- */
    const sectionHeader = (label: string) => {
      doc.rect(M, y, 3, 12).fill(GOLD);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text(label, M + 10, y - 1);
      y += 20;
    };
    const rule = () => {
      doc.moveTo(M, y).lineTo(M + contentW, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 14;
    };
    const kvGrid = (pairs: [string, unknown][]) => {
      const colW = contentW / 2;
      for (let i = 0; i < pairs.length; i += 2) {
        const rowY = y;
        for (let c = 0; c < 2; c++) {
          const pair = pairs[i + c];
          if (!pair) continue;
          const x = M + c * colW;
          doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(pair[0].toUpperCase(), x, rowY, { width: colW - 12 });
          doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(String(pair[1] ?? '—'), x, rowY + 11, { width: colW - 12 });
        }
        y = rowY + 32;
      }
    };

    /* ---- request details ---- */
    sectionHeader('Request Details');
    kvGrid([
      ['Request ID', r.requestId],
      ['Applicant', r.applicant?.name],
      ['Mobile', r.applicant?.mobile],
      ['Department', r.primaryDepartmentId?.name ?? 'Unassigned'],
      ['Priority', r.priorityId?.name ?? '—'],
      ['Due date', r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'Not set'],
    ]);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('SUBJECT', M, y, { width: contentW });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(r.subject ?? '—', M, y + 11, { width: contentW });
    y += 11 + doc.heightOfString(r.subject ?? '—', { width: contentW }) + 16;
    rule();

    /* ---- document checklist ---- */
    sectionHeader('Document Checklist');
    const checklistTop = y;
    const checklistRows = docs.length ? docs.length : 1;
    const checklistH = checklistRows * 18 + 12;
    doc.roundedRect(M, checklistTop, contentW, checklistH, 6).lineWidth(1).strokeColor(LINE).stroke();
    y += 10;
    if (!docs.length) {
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9).text('No documents attached yet.', M + 14, y);
      y += 18;
    } else {
      docs.forEach((d: any) => {
        doc.rect(M + 14, y + 1, 9, 9).lineWidth(1).strokeColor(NAVY).stroke();
        doc.fillColor(INK).font('Helvetica').fontSize(9).text(`${d.documentType} · ${d.documentId} (${d.pageCount} page${d.pageCount === 1 ? '' : 's'})`, M + 30, y);
        y += 18;
      });
    }
    y += 16;

    /* ---- timeline summary (zebra rows) ---- */
    sectionHeader('Timeline Summary');
    const rows = timeline.slice(0, 10) as any[];
    if (!rows.length) {
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9).text('No activity yet.', M, y);
      y += 16;
    } else {
      rows.forEach((t, i) => {
        const rowH = 17;
        if (i % 2 === 0) doc.rect(M, y - 2, contentW, rowH).fill(PANEL);
        doc.circle(M + 9, y + 5, 2.5).fill(GOLD);
        doc.fillColor(INK).font('Helvetica').fontSize(9).text(t.label, M + 20, y, { width: contentW - 170 });
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(new Date(t.createdAt).toLocaleString(), M + contentW - 150, y, { width: 150, align: 'right' });
        y += rowH;
      });
    }
    y += 16;

    /* ---- remarks / signature ---- */
    sectionHeader('Remarks & Sign-off');
    const boxH = 84;
    const boxGap = 14;
    const boxW = (contentW - boxGap) / 2;
    doc.roundedRect(M, y, boxW, boxH, 6).lineWidth(1).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('OFFICE REMARKS', M + 10, y + 8);
    doc.roundedRect(M + boxW + boxGap, y, boxW, boxH, 6).lineWidth(1).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('RECEIVED BY / SIGNATURE', M + boxW + boxGap + 10, y + 8);

    /* ---- footer ---- */
    const footerY = doc.page.height - 36;
    doc.moveTo(M, footerY - 10).lineTo(M + contentW, footerY - 10).lineWidth(1).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(
      `Generated by the MLA File Management System · ${new Date().toLocaleString()} · Scan the QR to open this file`,
      M, footerY, { width: contentW, align: 'center' },
    );

    doc.end();
  }),
);

export default router;
