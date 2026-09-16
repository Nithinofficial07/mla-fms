import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { RequestModel } from '../../models/Request.js';
import { listTimeline } from '../workflow/timeline.service.js';

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

    const events = await listTimeline({ requestId: String((doc as { _id: unknown })._id) });
    const timeline = events
      .filter((e) => PUBLIC_TIMELINE_ACTIONS.has(e.action as string))
      .map((e) => ({ action: e.action, label: e.label, toStatus: e.toStatus ?? null, at: e.createdAt }));

    const d = doc as typeof doc & {
      statusId?: { name?: string } | null;
      primaryDepartmentId?: { name?: string } | null;
      createdAt?: Date;
      updatedAt?: Date;
    };

    ok(res, {
      fileId: d.fileId,
      requestId: d.requestId,
      subject: d.subject,
      statusCode: d.statusCode,
      statusName: d.statusId?.name ?? d.statusCode,
      department: d.primaryDepartmentId?.name ?? null,
      submittedAt: d.submittedAt ?? d.createdAt,
      dueDate: d.dueDate ?? null,
      updatedAt: d.updatedAt,
      timeline,
    });
  }),
);

export default router;
