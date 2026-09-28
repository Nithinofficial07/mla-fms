import { TimelineEvent } from '../../models/workflow.js';

export type TimelineOwner =
  | { requestId: string; letterId?: never; fundingRequestId?: never }
  | { letterId: string; requestId?: never; fundingRequestId?: never }
  | { fundingRequestId: string; requestId?: never; letterId?: never };

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

/** Appends one immutable entry to a request's, letter's, or funding request's timeline. */
export function addTimeline(input: TimelineInput): Promise<unknown> {
  return TimelineEvent.create({
    requestId: input.requestId ?? null,
    letterId: input.letterId ?? null,
    fundingRequestId: input.fundingRequestId ?? null,
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
  const filter = 'requestId' in owner && owner.requestId
    ? { requestId: owner.requestId }
    : 'letterId' in owner && owner.letterId
      ? { letterId: owner.letterId }
      : { fundingRequestId: owner.fundingRequestId };
  return TimelineEvent.find(filter).sort('createdAt').lean();
}
