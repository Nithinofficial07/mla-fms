/**
 * Default seed values only. Every list here is stored in the database and is
 * fully editable from the Admin panel at runtime - nothing is hard-coded into
 * business logic. Code refers to documents by their _id, never by these labels.
 */

/** Area type governs which parent a location row hangs off. */
export const DEFAULT_AREA_TYPES = [
  { code: 'URBAN', name: 'Urban (Ward)', childLabel: 'Ward' },
  { code: 'RURAL', name: 'Rural (Gram Panchayat)', childLabel: 'Gram Panchayat' },
] as const;

export const DEFAULT_PRIORITIES = [
  { code: 'LOW', name: 'Low', slaDays: 30, color: '#2e7d32', order: 1 },
  { code: 'MEDIUM', name: 'Medium', slaDays: 15, color: '#ed6c02', order: 2 },
  { code: 'HIGH', name: 'High', slaDays: 7, color: '#d32f2f', order: 3 },
  { code: 'URGENT', name: 'Urgent', slaDays: 3, color: '#7b1fa2', order: 4 },
] as const;

/**
 * Default workflow. `isInitial` marks the state a new draft enters,
 * `isTerminal` marks closed states, `transitionsTo` lists allowed next codes.
 */
export const DEFAULT_STATUSES = [
  { code: 'DRAFT', name: 'Draft', order: 1, isInitial: true, isTerminal: false, color: '#9e9e9e', transitionsTo: ['SUBMITTED'] },
  { code: 'SUBMITTED', name: 'Submitted', order: 2, isInitial: false, isTerminal: false, color: '#1976d2', transitionsTo: ['UNDER_REVIEW', 'REJECTED'] },
  { code: 'UNDER_REVIEW', name: 'Under Review', order: 3, isInitial: false, isTerminal: false, color: '#0288d1', transitionsTo: ['ASSIGNED', 'REJECTED'] },
  { code: 'ASSIGNED', name: 'Assigned', order: 4, isInitial: false, isTerminal: false, color: '#7b1fa2', transitionsTo: ['FORWARDED', 'IN_PROGRESS'] },
  { code: 'FORWARDED', name: 'Forwarded', order: 5, isInitial: false, isTerminal: false, color: '#5e35b1', transitionsTo: ['IN_PROGRESS', 'AWAITING_INFO'] },
  { code: 'IN_PROGRESS', name: 'In Progress', order: 6, isInitial: false, isTerminal: false, color: '#ed6c02', transitionsTo: ['AWAITING_INFO', 'DEPT_RESPONSE', 'COMPLETED'] },
  { code: 'AWAITING_INFO', name: 'Awaiting Information', order: 7, isInitial: false, isTerminal: false, color: '#fbc02d', transitionsTo: ['IN_PROGRESS'] },
  { code: 'DEPT_RESPONSE', name: 'Department Response Received', order: 8, isInitial: false, isTerminal: false, color: '#00897b', transitionsTo: ['APPROVED', 'IN_PROGRESS'] },
  { code: 'APPROVED', name: 'Approved', order: 9, isInitial: false, isTerminal: false, color: '#2e7d32', transitionsTo: ['COMPLETED'] },
  { code: 'COMPLETED', name: 'Completed', order: 10, isInitial: false, isTerminal: false, color: '#388e3c', transitionsTo: ['CLOSED'] },
  { code: 'REJECTED', name: 'Rejected', order: 11, isInitial: false, isTerminal: true, color: '#c62828', transitionsTo: ['CLOSED'] },
  { code: 'CLOSED', name: 'Closed', order: 12, isInitial: false, isTerminal: true, color: '#455a64', transitionsTo: [] },
] as const;

export const DEFAULT_REQUEST_CATEGORIES = [
  'Road', 'Drinking Water', 'Electricity', 'Drainage', 'Housing', 'Education',
  'Health', 'Agriculture', 'Revenue', 'Transport', 'Pension',
  'Government Schemes', 'Infrastructure', 'Other',
];

export const DEFAULT_REQUEST_TYPES = [
  'Constituency Request', 'Public / Citizen Request', 'Departmental Reference',
  'Grievance', 'Information Request',
];

export const DEFAULT_DOCUMENT_TYPES = [
  'Application', 'ID Document', 'Supporting Document', 'Photograph',
  'Government Letter', 'Department Letter', 'Approval Document',
  'Sanction Document', 'Estimate', 'Work Order', 'Completion Document',
  'Response Document', 'Other',
];

export const DEFAULT_ID_TYPES = [
  'Aadhaar', 'Voter ID', 'PAN', 'Ration Card', 'Driving Licence', 'Other',
];

/** Values must stay in sync with the accept filter on the client uploader. */
export const SUPPORTED_UPLOAD_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'] as const;

export const NOTIFICATION_TYPES = [
  'REQUEST_ASSIGNED', 'REQUEST_FORWARDED', 'STATUS_CHANGED', 'REMARK_ADDED',
  'DOCUMENT_UPLOADED', 'DUE_DATE_APPROACHING', 'REQUEST_OVERDUE', 'REQUEST_COMPLETED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AUDIT_ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET',
  'CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE',
  'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_DELETE', 'DOCUMENT_SCAN',
  'REQUEST_SUBMIT', 'REQUEST_ASSIGN', 'REQUEST_FORWARD', 'STATUS_CHANGE',
  'REMARK_ADD', 'SETTINGS_CHANGE', 'IMPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
