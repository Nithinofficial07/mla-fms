import type { NotificationType } from '@mla/shared';
import { Notification } from '../../models/workflow.js';
import { logger } from '../../config/logger.js';

/**
 * Creates in-app notifications. Email/SMS fan-out is delegated to provider
 * stubs (see config) and is a no-op until configured.
 */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  n: { type: NotificationType | string; title: string; body?: string; requestId?: string; link?: string },
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))] as string[];
  if (!ids.length) return;
  try {
    await Notification.insertMany(
      ids.map((userId) => ({
        userId,
        type: n.type,
        title: n.title,
        body: n.body ?? '',
        requestId: n.requestId ?? null,
        link: n.link ?? null,
      })),
    );
  } catch (err) {
    logger.error({ err }, 'notification insert failed');
  }
}
