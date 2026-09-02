import { PERMISSIONS, Permission, ALL_PERMISSIONS } from './permissions.js';

/**
 * System role codes. Roles themselves are stored in the DB and are editable
 * by the Super Admin, but these codes are referenced by guards and seed data.
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MLA: 'MLA',
  DEPARTMENT_OFFICER: 'DEPARTMENT_OFFICER',
  DATA_ENTRY_OPERATOR: 'DATA_ENTRY_OPERATOR',
  VIEWER: 'VIEWER',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

const P = PERMISSIONS;

/** Default permission grants per role, applied by the seed script. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [ROLES.SUPER_ADMIN]: [...ALL_PERMISSIONS],

  [ROLES.ADMIN]: [
    P.REQUEST_CREATE, P.REQUEST_VIEW, P.REQUEST_EDIT, P.REQUEST_DELETE,
    P.REQUEST_ASSIGN, P.REQUEST_FORWARD, P.REQUEST_CLOSE, P.REQUEST_STATUS_CHANGE,
    P.DOCUMENT_UPLOAD, P.DOCUMENT_VIEW, P.DOCUMENT_DOWNLOAD, P.DOCUMENT_DELETE,
    P.REMARK_ADD,
    P.LETTER_CREATE, P.LETTER_VIEW, P.LETTER_EDIT, P.LETTER_DELETE,
    P.DEPARTMENT_MANAGE, P.LOCATION_MANAGE, P.CATEGORY_MANAGE, P.STATUS_MANAGE,
    P.USER_MANAGE,
    P.REPORT_VIEW, P.AUDIT_VIEW, P.DASHBOARD_VIEW, P.NOTIFICATION_VIEW,
  ],

  [ROLES.MLA]: [
    P.REQUEST_CREATE, P.REQUEST_VIEW, P.REQUEST_FORWARD, P.REQUEST_CLOSE,
    P.REQUEST_STATUS_CHANGE,
    P.LETTER_CREATE, P.LETTER_VIEW, P.LETTER_EDIT,
    P.DOCUMENT_VIEW, P.DOCUMENT_DOWNLOAD, P.DOCUMENT_UPLOAD,
    P.REMARK_ADD,
    P.REPORT_VIEW, P.DASHBOARD_VIEW, P.NOTIFICATION_VIEW,
  ],

  [ROLES.DEPARTMENT_OFFICER]: [
    P.REQUEST_VIEW, P.REQUEST_STATUS_CHANGE, P.REQUEST_FORWARD,
    P.DOCUMENT_UPLOAD, P.DOCUMENT_VIEW, P.DOCUMENT_DOWNLOAD,
    P.REMARK_ADD,
    P.DASHBOARD_VIEW, P.NOTIFICATION_VIEW,
  ],

  [ROLES.DATA_ENTRY_OPERATOR]: [
    P.REQUEST_CREATE, P.REQUEST_VIEW, P.REQUEST_EDIT,
    P.LETTER_CREATE, P.LETTER_VIEW, P.LETTER_EDIT,
    P.DOCUMENT_UPLOAD, P.DOCUMENT_VIEW,
    P.NOTIFICATION_VIEW,
  ],

  [ROLES.VIEWER]: [
    P.REQUEST_VIEW, P.LETTER_VIEW, P.DOCUMENT_VIEW, P.REPORT_VIEW, P.DASHBOARD_VIEW,
    P.NOTIFICATION_VIEW,
  ],
};

export const SYSTEM_ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  [ROLES.SUPER_ADMIN]: 'Full, unrestricted access including system configuration.',
  [ROLES.ADMIN]: 'Manages requests, departments, locations, users, documents and reports.',
  [ROLES.MLA]: 'Principal user. Oversight dashboard, can add/forward/close requests.',
  [ROLES.DEPARTMENT_OFFICER]: 'Access limited to requests assigned to their department.',
  [ROLES.DATA_ENTRY_OPERATOR]: 'Creates requests and uploads/scans documents.',
  [ROLES.VIEWER]: 'Read-only access.',
};
