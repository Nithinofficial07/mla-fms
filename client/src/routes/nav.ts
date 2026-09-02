import { PERMISSIONS } from '@mla/shared';

export interface NavItem {
  label: string;
  to?: string;
  icon: string; // MUI icon name
  permission?: string;
  children?: NavItem[];
}

/** Sidebar structure. Items are filtered by permission at render time. */
export const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: 'Dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  {
    label: 'Requests',
    icon: 'FolderShared',
    permission: PERMISSIONS.REQUEST_VIEW,
    children: [
      { label: 'All Requests', to: '/requests', icon: 'ListAlt' },
      { label: 'New Request', to: '/requests/new', icon: 'AddCircleOutline', permission: PERMISSIONS.REQUEST_CREATE },
      { label: 'Drafts', to: '/requests?statusCode=DRAFT', icon: 'EditNote' },
      { label: 'Pending', to: '/requests?bucket=pending', icon: 'HourglassEmpty' },
      { label: 'In Progress', to: '/requests?bucket=in-progress', icon: 'Autorenew' },
      { label: 'Completed', to: '/requests?bucket=completed', icon: 'TaskAlt' },
      { label: 'Overdue', to: '/requests?overdue=true', icon: 'ReportProblem' },
    ],
  },
  {
    label: 'MLA Letters',
    icon: 'Mail',
    permission: PERMISSIONS.LETTER_VIEW,
    children: [
      { label: 'All Letters', to: '/letters', icon: 'Drafts' },
      { label: 'New Letter', to: '/letters/new', icon: 'AddCircleOutline', permission: PERMISSIONS.LETTER_CREATE },
    ],
  },
  {
    label: 'Departments',
    icon: 'AccountBalance',
    permission: PERMISSIONS.DASHBOARD_VIEW,
    children: [
      { label: 'All Departments', to: '/departments', icon: 'Business' },
      { label: 'Import Departments', to: '/departments/import', icon: 'UploadFile', permission: PERMISSIONS.DEPARTMENT_MANAGE },
    ],
  },
  {
    label: 'Locations',
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
    icon: 'Tune',
    permission: PERMISSIONS.CATEGORY_MANAGE,
    children: [
      { label: 'Request Categories', to: '/config/categories', icon: 'Label' },
      { label: 'Statuses / Workflow', to: '/config/statuses', icon: 'Timeline', permission: PERMISSIONS.STATUS_MANAGE },
      { label: 'Priorities', to: '/config/priorities', icon: 'Flag', permission: PERMISSIONS.STATUS_MANAGE },
      { label: 'Lookups', to: '/config/lookups', icon: 'ViewList', permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
  { label: 'Users', to: '/users', icon: 'Group', permission: PERMISSIONS.USER_MANAGE },
  { label: 'Roles', to: '/roles', icon: 'AdminPanelSettings', permission: PERMISSIONS.ROLE_MANAGE },
  { label: 'Notifications', to: '/notifications', icon: 'Notifications', permission: PERMISSIONS.NOTIFICATION_VIEW },
  { label: 'Reports', to: '/reports', icon: 'Assessment', permission: PERMISSIONS.REPORT_VIEW },
  { label: 'Audit Logs', to: '/audit', icon: 'History', permission: PERMISSIONS.AUDIT_VIEW },
  { label: 'Settings', to: '/settings', icon: 'Settings', permission: PERMISSIONS.SETTINGS_MANAGE },
];
