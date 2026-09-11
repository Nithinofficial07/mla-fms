import { Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { RecordDrawer } from '@/components/RecordDrawer';
import { StatusChip, PriorityChip } from '@/components/chips';
import { Icon } from '@/components/Icon';
import { api } from '@/api/client';

/** Where a request happened, in one line - urban ward or rural GP/village. */
function locationLine(r: any): string {
  const loc = r?.location;
  if (!loc) return '—';
  if (loc.wardId?.name) return [`Ward: ${loc.wardId.name}`, loc.addressText].filter(Boolean).join(' — ');
  if (loc.gramPanchayatId?.name) {
    return [loc.gramPanchayatId.name, loc.villageId?.name, loc.subVillageId?.name].filter(Boolean).join(' › ');
  }
  if (loc.otherPlaceName) return [`Other: ${loc.otherPlaceName}`, loc.addressText].filter(Boolean).join(' — ');
  return '—';
}

/**
 * Quick-view side panel for a single request - pass `id` (or null to keep
 * it closed). Shares the same query key as RequestDetailPage, so opening
 * the full file afterwards is instant.
 */
export function RequestQuickView({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['requests', 'one', id],
    queryFn: () => api.get(`/requests/${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const r = detail.data;

  return (
    <RecordDrawer
      open={!!id}
      onClose={onClose}
      loading={detail.isLoading}
      eyebrow="Request"
      title={r?.fileId}
      subtitle={r?.subject}
      fullHref={id ? `/requests/${id}` : undefined}
      fullLabel="Open full file"
      chips={
        r && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <StatusChip code={r.statusCode} label={r.statusId?.name} />
            <PriorityChip code={r.priorityId?.code} label={r.priorityId?.name} />
          </Stack>
        )
      }
      fields={[
        { label: 'Applicant', value: r?.applicant?.name },
        { label: 'Mobile', value: r?.applicant?.mobile },
        { label: 'Location', value: locationLine(r) },
        { label: 'Department', value: r?.primaryDepartmentId?.name ?? 'Unassigned' },
        { label: 'Category', value: r?.categoryId?.name },
        { label: 'Created', value: r?.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY, hh:mm A') : undefined },
        {
          label: 'Due date',
          value: r?.dueDate ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="Event" fontSize="inherit" /> {dayjs(r.dueDate).format('DD MMM YYYY')}
            </span>
          ) : undefined,
        },
        { label: 'Description', value: r?.description },
      ]}
    />
  );
}
