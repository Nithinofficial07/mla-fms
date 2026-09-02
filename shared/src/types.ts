import type { Permission } from './permissions.js';
import type { RoleCode } from './roles.js';

/** Generic paginated list envelope returned by every list endpoint. */
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string; // e.g. "-createdAt" or "applicantName"
  search?: string;
  [filterKey: string]: unknown;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
  roleCode: RoleCode | string;
  permissions: Permission[];
  departmentId: string | null;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

/** Shape used by the cascading location picker on the request form. */
export interface LocationOption {
  id: string;
  name: string;
  code?: string;
  parentId?: string | null;
}

export interface DashboardStats {
  totalFiles: number;
  newRequests: number;
  pending: number;
  inProgress: number;
  completed: number;
  rejected: number;
  overdue: number;
  urgent: number;
  departmentPending: number;
  todayRequests: number;
}

export interface TimelineEntry {
  id: string;
  action: string;
  actorName: string;
  actorId: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  remark?: string | null;
  attachments?: string[];
  at: string; // ISO
}

export type IsoDateString = string;
