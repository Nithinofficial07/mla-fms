import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { RequestModel } from '../../models/Request.js';
import { listTimeline } from '../workflow/timeline.service.js';
import { readQrToken } from '../../utils/qrToken.js';

/**
 * Public, unauthenticated endpoints - no `authenticate` middleware anywhere
 * in this file, by design. Every response here must be safe to show a
 * citizen with nothing but their own File ID + mobile number: no remarks,
 * no officer names, no documents, no other applicants' data.
 */
const router = Router();

/** Same budget as login/forgot-password - this is exactly the kind of endpoint brute-forcing targets. */
const trackLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
});

const trackSchema = z.object({
  fileId: z.string().trim().min(3).max(60),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

/** Lifecycle milestones only - remarks, document activity and internal notes never leave this allowlist. */
const PUBLIC_TIMELINE_ACTIONS = new Set([
  'FILE_CREATED', 'REQUEST_SUBMIT', 'STATUS_CHANGE', 'REQUEST_ASSIGN', 'REQUEST_FORWARD',
]);

type LeanRequestDoc = Record<string, unknown> & {
  _id: unknown;
  fileId: string;
  requestId: string;
  subject: string;
  statusCode: string;
  statusId?: { name?: string } | null;
  primaryDepartmentId?: { name?: string } | null;
  submittedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  dueDate?: Date | null;
};

/** Builds the citizen-safe status + timeline payload shared by /track and the QR landing page, so both always reflect the same live data - never a snapshot baked in earlier. */
async function toPublicPayload(doc: LeanRequestDoc) {
  const events = await listTimeline({ requestId: String(doc._id) });
  const timeline = events
    .filter((e) => PUBLIC_TIMELINE_ACTIONS.has(e.action as string))
    .map((e) => ({ action: e.action, label: e.label, toStatus: e.toStatus ?? null, at: e.createdAt }));

  return {
    fileId: doc.fileId,
    requestId: doc.requestId,
    subject: doc.subject,
    statusCode: doc.statusCode,
    statusName: doc.statusId?.name ?? doc.statusCode,
    department: doc.primaryDepartmentId?.name ?? null,
    submittedAt: doc.submittedAt ?? doc.createdAt,
    dueDate: doc.dueDate ?? null,
    updatedAt: doc.updatedAt,
    timeline,
  };
}

router.post(
  '/track',
  trackLimiter,
  validate({ body: trackSchema }),
  asyncHandler(async (req, res) => {
    const { fileId, mobile } = req.body as z.infer<typeof trackSchema>;

    const doc = await RequestModel.findOne({ fileId, 'applicant.mobile': mobile })
      .populate(['statusId', 'primaryDepartmentId'])
      .lean();

    // Deliberately vague - never reveal whether the File ID or the mobile number was the mismatch.
    if (!doc) throw AppError.notFound('No matching request found. Check the File ID and mobile number and try again.');

    ok(res, await toPublicPayload(doc as LeanRequestDoc));
  }),
);

/** Scanning a file's QR (no login) lands here - always resolves the token fresh, so it's live tracking, not a status baked into the QR at print time. */
const qrLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
});

router.get(
  '/qr/:token',
  qrLimiter,
  asyncHandler(async (req, res) => {
    let requestId: string;
    try {
      requestId = readQrToken(req.params.token);
    } catch {
      throw AppError.badRequest('This QR code is invalid or has expired.');
    }

    const doc = await RequestModel.findById(requestId)
      .populate(['statusId', 'primaryDepartmentId'])
      .lean();
    if (!doc) throw AppError.notFound('This file could not be found.');

    ok(res, await toPublicPayload(doc as LeanRequestDoc));
  }),
);

export default router;
