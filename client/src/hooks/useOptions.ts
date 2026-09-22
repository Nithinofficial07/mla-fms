import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

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

export const useCategories = () =>
  useQuery({ queryKey: ['opt', 'categories'], queryFn: () => byOrder('/request-categories', { pageSize: 200, sort: 'order,name' }) });

export const useStatuses = () =>
  useQuery({ queryKey: ['opt', 'statuses'], queryFn: () => byOrder('/request-statuses', { pageSize: 100, sort: 'order,name' }) });

// Departments have no inherent order - straight A-Z.
export const useDepartments = () =>
  useQuery({ queryKey: ['opt', 'departments'], queryFn: () => alphabetical('/departments', { pageSize: 500, sort: 'name' }) });

export const useLookup = (group: string) =>
  useQuery({ queryKey: ['opt', 'lookup', group], queryFn: () => byOrder('/lookups', { group, pageSize: 200, sort: 'order,name' }) });

/* cascading location options - straight A-Z, same as departments. */
export const useWards = () =>
  useQuery({ queryKey: ['opt', 'wards'], queryFn: () => alphabetical('/location-options/wards') });

export const useGramPanchayats = () =>
  useQuery({ queryKey: ['opt', 'gps'], queryFn: () => alphabetical('/location-options/gram-panchayats') });

export const useVillages = (parent: { wardId?: string; gramPanchayatId?: string }) =>
  useQuery({
    queryKey: ['opt', 'villages', parent],
    queryFn: () => alphabetical('/location-options/villages', parent),
    enabled: !!(parent.wardId || parent.gramPanchayatId),
  });

export const useSubVillages = (villageId?: string) =>
  useQuery({
    queryKey: ['opt', 'subvillages', villageId],
    queryFn: () => alphabetical('/location-options/sub-villages', { villageId }),
    enabled: !!villageId,
  });
