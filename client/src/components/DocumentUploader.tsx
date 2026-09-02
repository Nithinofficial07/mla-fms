import { useRef, useState } from 'react';
import {
  Box, Button, LinearProgress, List, ListItem, ListItemText, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { api, errorMessage } from '@/api/client';
import { Icon } from './Icon';
import { ScannerDialog } from './scanner/ScannerDialog';
import { useLookup } from '@/hooks/useOptions';

export type DocOwner = { kind: 'request' | 'letter'; id: string };

/**
 * Drag-and-drop + Take Photo + Scan Document uploader. Posts multipart to
 * /api/documents/{request|letter}/:id (or the /scan endpoint for generated PDFs).
 */
export function DocumentUploader({ owner, onUploaded }: { owner: DocOwner; onUploaded: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const base = `/documents/${owner.kind}/${owner.id}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const docTypes = useLookup('DOCUMENT_TYPE');
  const [documentType, setDocumentType] = useState('Supporting Document');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('documentType', documentType);
    if (description) fd.append('description', description);
    try {
      setProgress(0);
      await api.post(base, fd, {
        onUploadProgress: (e) => setProgress(Math.round((e.loaded / (e.total ?? 1)) * 100)),
      });
      enqueueSnackbar(`${files.length} document(s) uploaded`, { variant: 'success' });
      onUploaded();
      setDescription('');
    } catch (e) {
      enqueueSnackbar(errorMessage(e, 'Upload failed'), { variant: 'error' });
    } finally {
      setProgress(null);
    }
  };

  const uploadScan = async (pdf: File, pageCount: number) => {
    const fd = new FormData();
    fd.append('file', pdf);
    fd.append('documentType', documentType);
    fd.append('pageCount', String(pageCount));
    if (description) fd.append('description', description);
    try {
      setProgress(0);
      await api.post(`${base}/scan`, fd, {
        onUploadProgress: (e) => setProgress(Math.round((e.loaded / (e.total ?? 1)) * 100)),
      });
      enqueueSnackbar('Scanned document attached', { variant: 'success' });
      onUploaded();
    } catch (e) {
      enqueueSnackbar(errorMessage(e, 'Upload failed'), { variant: 'error' });
    } finally {
      setProgress(null);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Document type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {(docTypes.data ?? [{ id: 'x', name: 'Supporting Document' }]).map((d) => (
            <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />
      </Stack>

      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'primary.light' : 'background.default',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          transition: 'all .15s',
        }}
      >
        <Icon name="CloudUpload" sx={{ fontSize: 40, opacity: 0.5 }} />
        <Typography sx={{ mt: 1 }}>Drag &amp; drop files here, or</Typography>
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<Icon name="AttachFile" />} onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          <Button component="label" variant="outlined" startIcon={<Icon name="PhotoCamera" />}>
            Take photo
            <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))} />
          </Button>
          <Button variant="outlined" startIcon={<Icon name="DocumentScanner" />} onClick={() => setScannerOpen(true)}>
            Scan document
          </Button>
        </Stack>
        <input
          ref={inputRef}
          hidden
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          PDF, JPG, PNG, WEBP, DOC/DOCX · up to 10 MB each
        </Typography>
      </Box>

      {progress !== null && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption">{progress}%</Typography>
        </Box>
      )}

      <List dense sx={{ display: 'none' }}>
        <ListItem>
          <ListItemText />
        </ListItem>
      </List>

      <ScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onComplete={uploadScan} />
    </Box>
  );
}
