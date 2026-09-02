import { TimelineEvent } from '../../models/workflow.js';

export interface TimelineInput {
  requestId: string;
  action: string;
  label: string;
  actorId?: string | null;
  actorName?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remark?: string | null;
  attachments?: string[];
  meta?: unknown;
}

/** Appends one immutable entry to a request's timeline. */
export function addTimeline(input: TimelineInput): Promise<unknown> {
  return TimelineEvent.create({
    requestId: input.requestId,
    action: input.action,
    label: input.label,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? 'system',
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    remark: input.remark ?? null,
    attachments: input.attachments ?? [],
    meta: input.meta,
  });
}

export function listTimeline(requestId: string) {
  return TimelineEvent.find({ requestId }).sort('createdAt').lean();
}
