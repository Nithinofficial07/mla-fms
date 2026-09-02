/**
 * Central permission catalogue.
 * Permissions are fine-grained and combined with roles (see roles.ts).
 * The Admin panel can attach/detach these to roles at runtime; this list is
 * only the seed/default set and the source of truth for type-safety.
 */
export const PERMISSIONS = {
  // requests
  REQUEST_CREATE: 'request.create',
  REQUEST_VIEW: 'request.view',
  REQUEST_EDIT: 'request.edit',
  REQUEST_DELETE: 'request.delete',
  REQUEST_ASSIGN: 'request.assign',
  REQUEST_FORWARD: 'request.forward',
  REQUEST_CLOSE: 'request.close',
  REQUEST_STATUS_CHANGE: 'request.status_change',

  // MLA letters
  LETTER_CREATE: 'letter.create',
  LETTER_VIEW: 'letter.view',
  LETTER_EDIT: 'letter.edit',
  LETTER_DELETE: 'letter.delete',

  // documents
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_DOWNLOAD: 'document.download',
  DOCUMENT_DELETE: 'document.delete',

  // remarks
  REMARK_ADD: 'remark.add',

  // masters / config
  DEPARTMENT_MANAGE: 'department.manage',
  LOCATION_MANAGE: 'location.manage',
  CATEGORY_MANAGE: 'category.manage',
  STATUS_MANAGE: 'status.manage',
  SETTINGS_MANAGE: 'settings.manage',

  // people
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',

  // insight
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',
  DASHBOARD_VIEW: 'dashboard.view',

  // notifications
  NOTIFICATION_VIEW: 'notification.view',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type Permission = (typeof PERMISSIONS)[PermissionKey];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);
