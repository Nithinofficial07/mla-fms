import { Dialog, DialogContent } from '@mui/material';
import { RequestDetailContent } from './RequestDetailContent';

/**
 * The request dossier in a large dialog instead of navigating to a separate
 * page - milestone stepper, activity feed & remarks, and the applicant /
 * location sidebar. Documents, Petition Details and Workflow Actions live
 * only on the full routed page, not here. Pass `id` (or null to keep it
 * closed).
 */
export function RequestDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: { md: '92vh' } } }}
    >
      <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
        {id && <RequestDetailContent id={id} onClose={onClose} compact />}
      </DialogContent>
    </Dialog>
  );
}
