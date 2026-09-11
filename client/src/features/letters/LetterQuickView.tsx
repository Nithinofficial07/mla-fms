import { Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { RecordDrawer } from '@/components/RecordDrawer';
import { api } from '@/api/client';

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success' | 'warning'> = {
  DRAFT: 'default', ISSUED: 'info', DISPATCHED: 'primary', REPLIED: 'warning', CLOSED: 'success',
};

function locationLine(l: any): string {
  const loc = l?.location;
  if (!loc) return '—';
  if (loc.wardId?.name) return [`Ward: ${loc.wardId.name}`, loc.addressText].filter(Boolean).join(' — ');
  if (loc.gramPanchayatId?.name) {
    return [loc.gramPanchayatId.name, loc.villageId?.name, loc.subVillageId?.name].filter(Boolean).join(' › ');
  }
  if (loc.otherPlaceName) return [`Other: ${loc.otherPlaceName}`, loc.addressText].filter(Boolean).join(' — ');
  return '—';
}

/** Quick-view side panel for a single MLA letter. */
export function LetterQuickView({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['letters', 'one', id],
    queryFn: () => api.get(`/letters/${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const l = detail.data;

  return (
    <RecordDrawer
      open={!!id}
      onClose={onClose}
      loading={detail.isLoading}
      eyebrow="MLA Letter"
      title={l?.letterNo}
      subtitle={l?.subject}
      fullHref={id ? `/letters/${id}` : undefined}
      fullLabel="Open full letter"
      chips={l && <Chip size="small" color={STATUS_COLOR[l.status] ?? 'default'} label={l.status} />}
      fields={[
        { label: 'Applicant', value: l?.applicant?.name },
        { label: 'Mobile', value: l?.applicant?.mobile },
        { label: 'Location', value: locationLine(l) },
        { label: 'Referred by', value: l?.referredBy },
        { label: 'Department', value: l?.departmentId?.name ?? '—' },
        { label: 'Dept. letter no.', value: l?.departmentLetterNo },
        { label: 'Date', value: l?.date ? dayjs(l.date).format('DD MMM YYYY') : undefined },
        { label: 'Description', value: l?.description },
      ]}
    />
  );
}
