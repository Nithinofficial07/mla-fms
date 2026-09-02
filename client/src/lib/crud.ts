import { api } from '@/api/client';

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ListParams = Record<string, string | number | boolean | undefined>;

/** REST resource client matching the server's crudFactory routes. */
export function makeResource<T extends { id: string }>(path: string) {
  return {
    path,
    list: (params: ListParams = {}) => api.get<Page<T>>(path, { params }).then((r) => r.data),
    get: (id: string) => api.get<T>(`${path}/${id}`).then((r) => r.data),
    create: (body: Partial<T> | Record<string, unknown>) => api.post<T>(path, body).then((r) => r.data),
    update: (id: string, body: Partial<T> | Record<string, unknown>) =>
      api.patch<T>(`${path}/${id}`, body).then((r) => r.data),
    remove: (id: string) => api.delete(`${path}/${id}`).then((r) => r.data),
    restore: (id: string) => api.post(`${path}/${id}/restore`).then((r) => r.data),
  };
}
