import { PERMISSIONS } from '@mla/shared';

export interface NavItem {
  label: string;
  /** i18next key for this item's label; falls back to `label` if the key has no translation. */
  labelKey?: string;
  to?: string;
  icon: string; // MUI icon name
  permission?: string;
  children?: NavItem[];
}

/** Sidebar structure. Items are filtered by permission at render time. */
export const NAV: NavItem[] = [
  { label: 'Dashboard', labelKey: 'nav.dashboard', to: '/', icon: 'Dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  {
    label: 'Requests',
    labelKey: 'nav.requests',
    icon: 'FolderShared',
    permission: PERMISSIONS.REQUEST_VIEW,
    children: [
      { label: 'All Requests', labelKey: 'nav.allRequests', to: '/requests', icon: 'ListAlt' },
      { label: 'New Request', labelKey: 'nav.newRequest', to: '/requests/new', icon: 'AddCircleOutline', permission: PERMISSIONS.REQUEST_CREATE },
      { label: 'Drafts', labelKey: 'nav.drafts', to: '/requests?statusCode=DRAFT', icon: 'EditNote' },
      { label: 'Pending', labelKey: 'nav.pending', to: '/requests?bucket=pending', icon: 'HourglassEmpty' },
      { label: 'In Progress', labelKey: 'nav.inProgress', to: '/requests?bucket=in-progress', icon: 'Autorenew' },
      { label: 'Completed', labelKey: 'nav.completed', to: '/requests?bucket=completed', icon: 'TaskAlt' },
      { label: 'Overdue', labelKey: 'nav.overdue', to: '/requests?overdue=true', icon: 'ReportProblem' },
    ],
  },
  {
    label: 'MLA Letters',
    labelKey: 'nav.letters',
    icon: 'Mail',
    permission: PERMISSIONS.LETTER_VIEW,
    children: [
      { label: 'All Letters', labelKey: 'nav.allLetters', to: '/letters', icon: 'Drafts' },
      { label: 'New Letter', labelKey: 'nav.newLetter', to: '/letters/new', icon: 'AddCircleOutline', permission: PERMISSIONS.LETTER_CREATE },
    ],
  },
  {
    label: 'Departments',
    labelKey: 'nav.departments',
    icon: 'AccountBalance',
    permission: PERMISSIONS.DASHBOARD_VIEW,
    children: [
      { label: 'All Departments', labelKey: 'nav.allDepartments', to: '/departments', icon: 'Business' },
      { label: 'Import Departments', labelKey: 'nav.importDepartments', to: '/departments/import', icon: 'UploadFile', permission: PERMISSIONS.DEPARTMENT_MANAGE },
    ],
  },
  {
    label: 'Funding',
    labelKey: 'nav.funding',
    icon: 'AttachMoney',
    permission: PERMISSIONS.LETTER_VIEW,
    children: [
      { label: 'Departments', labelKey: 'nav.fundingDepartments', to: '/funding', icon: 'AccountBalance' },
      { label: 'All Funding Requests', labelKey: 'nav.allFundingRequests', to: '/funding/requests', icon: 'ListAlt' },
    ],
  },
  {
    label: 'Locations',
    labelKey: 'nav.locations',
    icon: 'Place',
    permission: PERMISSIONS.LOCATION_MANAGE,
    children: [
      { label: 'Area Types', to: '/locations/area-types', icon: 'Category' },
      { label: 'Wards', to: '/locations/wards', icon: 'Apartment' },
      { label: 'Gram Panchayats', to: '/locations/gram-panchayats', icon: 'Cottage' },
      { label: 'Villages', to: '/locations/villages', icon: 'Grass' },
      { label: 'Sub-villages', to: '/locations/sub-villages', icon: 'Spa' },
      { label: 'Bulk Import', to: '/locations/import', icon: 'UploadFile' },
    ],
  },
  {
    label: 'Configuration',
    labelKey: 'nav.configuration',
    icon: 'Tune',
    permission: PERMISSIONS.CATEGORY_MANAGE,
    children: [
      { label: 'Request Categories', to: '/config/categories', icon: 'Label' },
      { label: 'Statuses / Workflow', to: '/config/statuses', icon: 'Timeline', permission: PERMISSIONS.STATUS_MANAGE },
      { label: 'Priorities', to: '/config/priorities', icon: 'Flag', permission: PERMISSIONS.STATUS_MANAGE },
      { label: 'Lookups', to: '/config/lookups', icon: 'ViewList', permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
  { label: 'Principals', labelKey: 'nav.principals', to: '/principals', icon: 'AccountBalance', permission: PERMISSIONS.PRINCIPAL_MANAGE },
  { label: 'Users', labelKey: 'nav.users', to: '/users', icon: 'Group', permission: PERMISSIONS.USER_MANAGE },
  { label: 'Roles', labelKey: 'nav.roles', to: '/roles', icon: 'AdminPanelSettings', permission: PERMISSIONS.ROLE_MANAGE },
  { label: 'Notifications', labelKey: 'nav.notifications', to: '/notifications', icon: 'Notifications', permission: PERMISSIONS.NOTIFICATION_VIEW },
  { label: 'Reports', labelKey: 'nav.reports', to: '/reports', icon: 'Assessment', permission: PERMISSIONS.REPORT_VIEW },
  { label: 'Audit Logs', labelKey: 'nav.auditLogs', to: '/audit', icon: 'History', permission: PERMISSIONS.AUDIT_VIEW },
  { label: 'Settings', labelKey: 'nav.settings', to: '/settings', icon: 'Settings', permission: PERMISSIONS.SETTINGS_MANAGE },
];
