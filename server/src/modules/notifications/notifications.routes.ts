import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { parseListParams, paginate } from '../../utils/queryFeatures.js';
import { Notification } from '../../models/workflow.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = parseListParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = { userId: req.auth!.userId };
    if (req.query.unread === 'true') filter.readAt = null;
    ok(res, await paginate(Notification, filter, params));
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) =>
    ok(res, { count: await Notification.countDocuments({ userId: req.auth!.userId, readAt: null }) }),
  ),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, userId: req.auth!.userId }, { readAt: new Date() });
    ok(res, { ok: true });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ userId: req.auth!.userId, readAt: null }, { readAt: new Date() });
    ok(res, { ok: true });
  }),
);

export default router;
