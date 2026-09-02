import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { makeResource, type ListParams } from '@/lib/crud';
import { errorMessage } from '@/api/client';

/** Query + mutation hooks for a simple master-data resource path. */
export function useResource<T extends { id: string }>(path: string) {
  const resource = makeResource<T>(path);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const invalidate = () => qc.invalidateQueries({ queryKey: [path] });

  const useList = (params: ListParams = {}) =>
    useQuery({
      queryKey: [path, params],
      queryFn: () => resource.list(params),
      placeholderData: keepPreviousData,
    });

  const useOne = (id?: string) =>
    useQuery({ queryKey: [path, 'one', id], queryFn: () => resource.get(id!), enabled: !!id });

  const useCreate = () =>
    useMutation({
      mutationFn: (body: Record<string, unknown>) => resource.create(body),
      onSuccess: () => {
        enqueueSnackbar('Created', { variant: 'success' });
        invalidate();
      },
      onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
    });

  const useUpdate = () =>
    useMutation({
      mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => resource.update(id, body),
      onSuccess: () => {
        enqueueSnackbar('Saved', { variant: 'success' });
        invalidate();
      },
      onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
    });

  const useRemove = () =>
    useMutation({
      mutationFn: (id: string) => resource.remove(id),
      onSuccess: () => {
        enqueueSnackbar('Deactivated', { variant: 'success' });
        invalidate();
      },
      onError: (e) => enqueueSnackbar(errorMessage(e), { variant: 'error' }),
    });

  return { resource, useList, useOne, useCreate, useUpdate, useRemove, invalidate };
}
