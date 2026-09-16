import { TimelineEvent } from '../../models/workflow.js';

export type TimelineOwner = { requestId: string; letterId?: never } | { letterId: string; requestId?: never };

export type TimelineInput = TimelineOwner & {
  action: string;
  label: string;
  actorId?: string | null;
  actorName?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remark?: string | null;
  attachments?: string[];
  meta?: unknown;
};

/** Appends one immutable entry to a request's or letter's timeline. */
export function addTimeline(input: TimelineInput): Promise<unknown> {
  return TimelineEvent.create({
    requestId: input.requestId ?? null,
    letterId: input.letterId ?? null,
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

export function listTimeline(owner: TimelineOwner) {
  const filter = 'requestId' in owner && owner.requestId ? { requestId: owner.requestId } : { letterId: owner.letterId };
  return TimelineEvent.find(filter).sort('createdAt').lean();
}
