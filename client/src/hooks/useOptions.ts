import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@mla/shared';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

interface Opt { id: string; name: string; code?: string; order?: number; ministryName?: string }

const listFetcher = (path: string, params?: Record<string, unknown>) =>
  api.get(path, { params }).then((r) => (Array.isArray(r.data) ? r.data : r.data.data)) as Promise<Opt[]>;

/**
 * True case-insensitive "standard" A-Z compare. The server's `sort=name`
 * does a plain byte-order sort (Mongo default), which puts every ALL-CAPS
 * name (e.g. "AYUSH", "BESCOM") ahead of same-letter Title-Case names
 * ("Agriculture") since 'A'-'Z' sorts before 'a'-'z' byte-wise - not what
 * "alphabetical" means to a reader. Re-sorting here fixes that without
 * touching the shared server-side pagination used by non-dropdown lists.
 */
const byName = (a: Opt, b: Opt) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Respects a meaningful `order` (severity/workflow sequence) first, A-Z as the tiebreak. */
const byOrderThenName = (a: Opt, b: Opt) => (a.order ?? 0) - (b.order ?? 0) || byName(a, b);

const sortedBy = (compare: (a: Opt, b: Opt) => number) => (path: string, params?: Record<string, unknown>) =>
  listFetcher(path, params).then((list) => list.slice().sort(compare));

const alphabetical = sortedBy(byName);
const byOrder = sortedBy(byOrderThenName);

// Priorities/statuses have a meaningful built-in sequence (severity / workflow
// stage) via their `order` field - sorted by that first, A-Z as the tiebreak
// (order defaults to 0 for everyone until an admin sets it, so ties are the
// common case today).
export const usePriorities = () =>
  useQuery({ queryKey: ['opt', 'priorities'], queryFn: () => byOrder('/priorities', { pageSize: 100, sort: 'order,name' }) });

// Categories are always alphabetical (A-Z), never manually ordered.
export const useCategories = () =>
  useQuery({ queryKey: ['opt', 'categories'], queryFn: () => alphabetical('/request-categories', { pageSize: 200, sort: 'name' }) });

export const useStatuses = () =>
  useQuery({ queryKey: ['opt', 'statuses'], queryFn: () => byOrder('/request-statuses', { pageSize: 100, sort: 'order,name' }) });

// Departments have no inherent order - straight A-Z.
export const useDepartments = () =>
  useQuery({ queryKey: ['opt', 'departments'], queryFn: () => alphabetical('/departments', { pageSize: 500, sort: 'name' }) });

export interface PrincipalOpt { id: string; code: string; label: string; idPrefix: string }
const PRINCIPAL_ORDER = ['MLA_S', 'MLA_N', 'MP'];

/** The office's 3 principals, in their fixed display order (not alphabetical - "MP" would sort before "MLA"). */
export const usePrincipals = () =>
  useQuery({
    queryKey: ['opt', 'principals'],
    queryFn: () =>
      api.get('/principals', { params: { pageSize: 10 } }).then((r) => r.data.data as PrincipalOpt[])
        .then((list) => list.slice().sort((a, b) => PRINCIPAL_ORDER.indexOf(a.code) - PRINCIPAL_ORDER.indexOf(b.code))),
  });

/**
 * Which principals (offices) the current user may act as. A PRINCIPAL_ALL_VIEW
 * user (e.g. Super Admin) gets every principal; everyone else only their own
 * assigned one(s) - the same rule the server enforces, so this never offers a
 * choice the backend would reject.
 */
export const useMyPrincipals = () => {
  const { user, can } = useAuth();
  const principals = usePrincipals();
  const allView = can(PERMISSIONS.PRINCIPAL_ALL_VIEW);
  const data = allView
    ? (principals.data ?? [])
    : (principals.data ?? []).filter((p) => user?.principalIds?.includes(p.id));
  return { data, allView, isLoading: principals.isLoading };
};

export const useLookup = (group: string) =>
  useQuery({ queryKey: ['opt', 'lookup', group], queryFn: () => byOrder('/lookups', { group, pageSize: 200, sort: 'order,name' }) });

/* cascading location options - straight A-Z, same as departments. */
export const useWards = () =>
  useQuery({ queryKey: ['opt', 'wards'], queryFn: () => alphabetical('/location-options/wards') });

// Rural GPs have a fixed display order (1-8, rendered as letters A-H).
export const useGramPanchayats = () =>
  useQuery({ queryKey: ['opt', 'gps'], queryFn: () => byOrder('/location-options/gram-panchayats') });

// Villages have their own display order too (e.g. by population estimate),
// rendered as Roman numerals - independent of their parent GP's lettering.
export const useVillages = (parent: { wardId?: string; gramPanchayatId?: string }) =>
  useQuery({
    queryKey: ['opt', 'villages', parent],
    queryFn: () => byOrder('/location-options/villages', parent),
    enabled: !!(parent.wardId || parent.gramPanchayatId),
  });

export interface OfficerOpt { id: string; name: string; designation?: string }

/** Officers belonging to a department, for the Immediate Intervention step's "Person" picker. */
export const useOfficers = (departmentId?: string) =>
  useQuery({
    queryKey: ['opt', 'officers', departmentId],
    queryFn: () => api.get('/requests/officers', { params: { departmentId } }).then((r) => r.data as OfficerOpt[]),
    enabled: !!departmentId,
  });

export const useSubVillages = (villageId?: string) =>
  useQuery({
    queryKey: ['opt', 'subvillages', villageId],
    queryFn: () => alphabetical('/location-options/sub-villages', { villageId }),
    enabled: !!villageId,
  });
