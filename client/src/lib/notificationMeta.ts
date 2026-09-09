import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** "3 minutes ago" / "in 2 hours". */
export const fromNow = (d: string | Date) => dayjs(d).fromNow();

type Meta = { icon: string; color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' };

const MAP: Record<string, Meta> = {
  REQUEST_ASSIGNED: { icon: 'AssignmentInd', color: 'primary' },
  REQUEST_FORWARDED: { icon: 'Forward', color: 'secondary' },
  STATUS_CHANGED: { icon: 'SwapHoriz', color: 'info' },
  REMARK_ADDED: { icon: 'Comment', color: 'info' },
  DOCUMENT_UPLOADED: { icon: 'UploadFile', color: 'primary' },
  DUE_DATE_APPROACHING: { icon: 'Event', color: 'warning' },
  REQUEST_OVERDUE: { icon: 'ReportProblem', color: 'error' },
  REQUEST_COMPLETED: { icon: 'TaskAlt', color: 'success' },
};

export const notificationMeta = (type: string): Meta => MAP[type] ?? { icon: 'Notifications', color: 'primary' };
