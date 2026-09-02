import dayjs from 'dayjs';
import { logger } from '../config/logger.js';
import { RequestModel } from '../models/Request.js';
import { RequestStatus, SystemSettings } from '../models/config.js';
import { notifyUsers } from '../modules/notifications/notify.js';

/**
 * Lightweight in-process jobs (no external queue for the scaffold).
 * - overdue sweep: notify owners once a request passes its due date
 * - due-soon sweep: notify when within `dueSoonDays`
 * Swap for a real cron / BullMQ worker in production (see docs/DEPLOYMENT.md).
 */
async function sweep(): Promise<void> {
  const cfg = await SystemSettings.findById('app').lean();
  const dueSoonDays = cfg?.notifications?.dueSoonDays ?? 2;
  const terminal = (await RequestStatus.find({ isTerminal: true }).select('code').lean()).map((s) => s.code);

  const now = new Date();
  const soon = dayjs().add(dueSoonDays, 'day').toDate();

  const overdue = await RequestModel.find({
    dueDate: { $lt: now },
    statusCode: { $nin: terminal },
  }).select('_id fileId subject assignedOfficerId createdBy').lean();

  const dueSoon = await RequestModel.find({
    dueDate: { $gte: now, $lte: soon },
    statusCode: { $nin: terminal },
  }).select('_id fileId subject assignedOfficerId createdBy').lean();

  for (const r of overdue) {
    await notifyUsers([r.assignedOfficerId ? String(r.assignedOfficerId) : null, String(r.createdBy)], {
      type: 'REQUEST_OVERDUE', title: `Overdue: ${r.fileId}`, body: r.subject,
      requestId: String(r._id), link: `/requests/${r._id}`,
    });
  }
  for (const r of dueSoon) {
    await notifyUsers([r.assignedOfficerId ? String(r.assignedOfficerId) : null], {
      type: 'DUE_DATE_APPROACHING', title: `Due soon: ${r.fileId}`, body: r.subject,
      requestId: String(r._id), link: `/requests/${r._id}`,
    });
  }
  logger.info({ overdue: overdue.length, dueSoon: dueSoon.length }, 'due-date sweep complete');
}

let timer: NodeJS.Timeout | null = null;

export function startJobs(): void {
  if (timer) return;
  const runSafely = () => sweep().catch((err) => logger.error({ err }, 'job sweep failed'));
  // first run after 30s, then hourly
  setTimeout(runSafely, 30_000);
  timer = setInterval(runSafely, 60 * 60 * 1000);
}

export function stopJobs(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
