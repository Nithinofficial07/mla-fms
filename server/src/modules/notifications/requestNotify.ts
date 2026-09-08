import { env } from '../../config/env.js';
import { Department } from '../../models/Department.js';
import { User } from '../../models/User.js';
import { SystemSettings } from '../../models/config.js';
import { logger } from '../../config/logger.js';
import { notifyUsers } from './notify.js';
import { queueEmail, emailLayout } from './email.js';

type Kind = 'CREATED' | 'ASSIGNED' | 'FORWARDED';

const VERB: Record<Kind, string> = {
  CREATED: 'submitted to',
  ASSIGNED: 'assigned to',
  FORWARDED: 'forwarded to',
};
const NTYPE: Record<Kind, string> = {
  CREATED: 'REQUEST_ASSIGNED',
  ASSIGNED: 'REQUEST_ASSIGNED',
  FORWARDED: 'REQUEST_FORWARDED',
};

interface RequestLike {
  _id: unknown;
  fileId: string;
  subject: string;
  applicant?: { name?: string | null; mobile?: string | null; address?: string | null } | null;
  priorityId?: unknown;
  primaryDepartmentId?: unknown;
}

/**
 * Routes a request to a department: in-app notification to the department's
 * officers (and/or the named officer), plus an email to the department's
 * address + officer emails when email is enabled in Settings and an SMTP
 * provider is configured. Fire-and-forget - never throws into the request path.
 */
export async function notifyRequestToDepartment(opts: {
  request: RequestLike;
  departmentId: string;
  officerId?: string | null;
  kind: Kind;
  priorityName?: string | null;
  wardOrArea?: string | null;
}): Promise<void> {
  try {
    const { request, departmentId, officerId, kind } = opts;
    const rid = String(request._id);
    const [dept, settings] = await Promise.all([
      Department.findById(departmentId).lean(),
      SystemSettings.findById('app').lean(),
    ]);
    if (!dept) return;

    const officers = officerId
      ? await User.find({ _id: officerId }).select('_id email name').lean()
      : await User.find({ departmentId, isActive: true }).select('_id email name').lean();

    const title = `${request.fileId} ${VERB[kind]} ${dept.name}`;
    const link = `/requests/${rid}`;

    if (settings?.notifications?.inApp !== false && officers.length) {
      await notifyUsers(
        officers.map((o) => String(o._id)),
        { type: NTYPE[kind], title, body: request.subject, requestId: rid, link },
      );
    }

    const emailOn = settings?.notifications?.email && env.EMAIL_PROVIDER !== 'none';
    if (emailOn) {
      const to = [dept.email, ...officers.map((o) => o.email)].filter((e): e is string => !!e);
      if (to.length) {
        queueEmail({
          to,
          subject: title,
          html: emailLayout(
            `A request has been ${VERB[kind]} your department`,
            [
              ['File ID', request.fileId],
              ['Subject', request.subject],
              ['Applicant', request.applicant?.name ?? ''],
              ['Mobile', request.applicant?.mobile ?? ''],
              ['Location', opts.wardOrArea ?? request.applicant?.address ?? ''],
              ['Priority', opts.priorityName ?? ''],
              ['Department', dept.name],
            ],
            'Open request',
            new URL(link, env.FRONTEND_URL).toString(),
          ),
        });
      }
    }
  } catch (err) {
    logger.error({ err }, 'notifyRequestToDepartment failed');
  }
}
