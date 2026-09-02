import {
  DEFAULT_AREA_TYPES, DEFAULT_PRIORITIES, DEFAULT_STATUSES,
  DEFAULT_REQUEST_CATEGORIES, DEFAULT_REQUEST_TYPES, DEFAULT_DOCUMENT_TYPES, DEFAULT_ID_TYPES,
  DEFAULT_ROLE_PERMISSIONS, ROLES, SYSTEM_ROLE_DESCRIPTIONS,
} from '@mla/shared';
import { AreaType } from '../models/location.js';
import { Priority, RequestCategory, RequestStatus, Lookup, SystemSettings } from '../models/config.js';
import { Role } from '../models/Role.js';

/**
 * The minimum reference data the app needs to function: system roles,
 * priorities, the workflow status graph, request categories, and the
 * REQUEST_TYPE / DOCUMENT_TYPE / ID_TYPE lookups. Idempotent - safe to run on
 * every deploy. Contains NO demo data (no departments, wards, users, requests).
 * Called by the first-run setup wizard and by `npm run seed`.
 */
export async function seedConfigDefaults(): Promise<void> {
  for (const code of Object.values(ROLES)) {
    await Role.findOneAndUpdate(
      { code },
      {
        $set: {
          permissions: DEFAULT_ROLE_PERMISSIONS[code],
          description: SYSTEM_ROLE_DESCRIPTIONS[code],
          isSystem: true,
        },
        $setOnInsert: { code, name: code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) },
      },
      { upsert: true },
    );
  }

  for (const at of DEFAULT_AREA_TYPES) {
    await AreaType.findOneAndUpdate({ code: at.code }, { $setOnInsert: at }, { upsert: true });
  }
  for (const p of DEFAULT_PRIORITIES) {
    await Priority.findOneAndUpdate({ code: p.code }, { $setOnInsert: p }, { upsert: true });
  }
  for (const s of DEFAULT_STATUSES) {
    await RequestStatus.findOneAndUpdate({ code: s.code }, { $setOnInsert: s }, { upsert: true });
  }
  for (let i = 0; i < DEFAULT_REQUEST_CATEGORIES.length; i++) {
    const name = DEFAULT_REQUEST_CATEGORIES[i];
    await RequestCategory.findOneAndUpdate({ name }, { $setOnInsert: { name, order: i } }, { upsert: true });
  }
  const groups: [string, string[]][] = [
    ['REQUEST_TYPE', DEFAULT_REQUEST_TYPES],
    ['DOCUMENT_TYPE', DEFAULT_DOCUMENT_TYPES],
    ['ID_TYPE', DEFAULT_ID_TYPES],
  ];
  for (const [group, names] of groups) {
    for (let i = 0; i < names.length; i++) {
      await Lookup.findOneAndUpdate(
        { group, name: names[i] },
        { $setOnInsert: { group, name: names[i], order: i } },
        { upsert: true },
      );
    }
  }

  await SystemSettings.findByIdAndUpdate('app', { $setOnInsert: { _id: 'app' } }, { upsert: true });
}
