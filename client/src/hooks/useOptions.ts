import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

interface Opt { id: string; name: string; code?: string }

const listFetcher = (path: string, params?: Record<string, unknown>) =>
  api.get(path, { params }).then((r) => (Array.isArray(r.data) ? r.data : r.data.data)) as Promise<Opt[]>;

export const usePriorities = () =>
  useQuery({ queryKey: ['opt', 'priorities'], queryFn: () => listFetcher('/priorities', { pageSize: 100 }) });

export const useCategories = () =>
  useQuery({ queryKey: ['opt', 'categories'], queryFn: () => listFetcher('/request-categories', { pageSize: 200 }) });

export const useStatuses = () =>
  useQuery({ queryKey: ['opt', 'statuses'], queryFn: () => listFetcher('/request-statuses', { pageSize: 100 }) });

export const useDepartments = () =>
  useQuery({ queryKey: ['opt', 'departments'], queryFn: () => listFetcher('/departments', { pageSize: 500 }) });

export const useLookup = (group: string) =>
  useQuery({ queryKey: ['opt', 'lookup', group], queryFn: () => listFetcher('/lookups', { group, pageSize: 200 }) });

/* cascading location options */
export const useWards = () =>
  useQuery({ queryKey: ['opt', 'wards'], queryFn: () => listFetcher('/location-options/wards') });

export const useGramPanchayats = () =>
  useQuery({ queryKey: ['opt', 'gps'], queryFn: () => listFetcher('/location-options/gram-panchayats') });

export const useVillages = (parent: { wardId?: string; gramPanchayatId?: string }) =>
  useQuery({
    queryKey: ['opt', 'villages', parent],
    queryFn: () => listFetcher('/location-options/villages', parent),
    enabled: !!(parent.wardId || parent.gramPanchayatId),
  });

export const useSubVillages = (villageId?: string) =>
  useQuery({
    queryKey: ['opt', 'subvillages', villageId],
    queryFn: () => listFetcher('/location-options/sub-villages', { villageId }),
    enabled: !!villageId,
  });
