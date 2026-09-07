import { Router } from 'express';
import { PERMISSIONS } from '@mla/shared';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { WARDS_GEOJSON } from '../../geo/wards.js';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.DASHBOARD_VIEW));

/**
 * GET /api/geo/wards
 * Static ward-boundary GeoJSON for the constituency map. Each feature's
 * `properties.wardNumber` matches Ward.number in the database.
 */
router.get(
  '/wards',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    ok(res, WARDS_GEOJSON);
  }),
);

export default router;
