import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { Icon } from '@/components/Icon';
import { api, errorMessage, getActivePrincipal } from '@/api/client';

const MOBILE_RE = /^[6-9]\d{9}$/;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the new request's id once it (and its photo) are saved. */
  onCreated?: (id: string) => void;
}

/**
 * Quick Request - a fast walk-in intake that needs only the applicant's name,
 * mobile number, a photo of their document and an optional intervention comment.
 * Everything else (subject, location, department...) can be completed later
 * from the file's detail page.
 */
export function QuickRequestDialog({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const reset = () => {
    setName(''); setMobile(''); setComment(''); setPhoto(null); setError(null);
  };

  const mobileInvalid = !!mobile && !MOBILE_RE.test(mobile);
  const canSave = name.trim().length > 0 && MOBILE_RE.test(mobile) && !!photo;

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/requests/quick', {
        principalId: getActivePrincipal(),
        name: name.trim(),
        mobile,
        comment: comment.trim() || undefined,
      });
      let photoFailed = false;
      try {
        const fd = new FormData();
        fd.append('files', photo as File);
        fd.append('documentType', 'Applicant Document');
        await api.post(`/documents/request/${data.id}`, fd);
      } catch {
        photoFailed = true;
      }
      return { data, photoFailed };
    },
    onSuccess: ({ data, photoFailed }) => {
      if (photoFailed) {
        enqueueSnackbar(`Created ${data.fileId}, but the photo failed to upload - attach it from the file page.`, { variant: 'warning' });
      } else {
        enqueueSnackbar(`Quick request ${data.fileId} created`, { variant: 'success' });
      }
      qc.invalidateQueries({ queryKey: ['requests'] });
      reset();
      onClose();
      onCreated?.(data.id);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Quick Request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          <TextField
            autoFocus fullWidth required label="Name"
            value={name} onChange={(e) => setName(e.target.value)}
          />
          <TextField
            fullWidth required label="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputProps={{ inputMode: 'numeric' }}
            error={mobileInvalid}
            helperText={mobileInvalid ? 'Enter a valid 10-digit mobile number' : '10-digit mobile number'}
          />
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>Document photo *</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button component="label" variant="outlined" startIcon={<Icon name="PhotoCamera" />}>
                Take photo
                <input
                  hidden type="file" accept="image/*" capture="environment"
                  onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
              </Button>
              <Button component="label" variant="outlined" startIcon={<Icon name="UploadFile" />}>
                Choose file
                <input
                  hidden type="file" accept="image/*,application/pdf"
                  onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
              </Button>
            </Stack>
            {photo && (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
                {preview && photo.type.startsWith('image/') && (
                  <Box
                    component="img" src={preview} alt="Document"
                    sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider' }}
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>{photo.name}</Typography>
                  <Button size="small" color="error" onClick={() => setPhoto(null)}>Remove</Button>
                </Box>
              </Stack>
            )}
          </Box>
          <TextField
            fullWidth multiline minRows={3} label="Comment / Intervention"
            value={comment} onChange={(e) => setComment(e.target.value)}
            helperText="What action is needed? Other details can be added later from the file."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={create.isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={!canSave || create.isPending}>
          {create.isPending ? 'Saving...' : 'Save quick request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
