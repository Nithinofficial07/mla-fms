import { useState } from 'react';
import {
  Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

interface Doc {
  id: string;
  documentId: string;
  documentType: string;
  pageCount: number;
  currentVersion: number;
  createdAt: string;
  versions: { fileName: string; size: number; mimeType: string; source: string }[];
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type DocOwner = { kind: 'request' | 'letter'; id: string };

export function DocumentList({ owner }: { owner: DocOwner }) {
  const { data, isLoading } = useQuery({
    queryKey: ['documents', owner.kind, owner.id],
    queryFn: () => api.get<Doc[]>(`/documents/${owner.kind}/${owner.id}`).then((r) => r.data),
  });
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);

  const openPreview = async (id: string) => {
    const { data: sig } = await api.get(`/documents/${id}/url`);
    setPreview({ url: sig.url, name: sig.fileName, mime: sig.mimeType });
  };
  const download = async (id: string) => {
    const { data: sig } = await api.get(`/documents/${id}/url`, { params: { download: 1 } });
    window.open(sig.url, '_blank');
  };

  if (!isLoading && (!data || data.length === 0)) {
    return <EmptyState icon="FolderOff" title="No documents uploaded" description="Upload or scan the application and supporting documents." />;
  }

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Document ID</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>File</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Pages</TableCell>
            <TableCell>Ver.</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(data ?? []).map((d) => {
            const cur = d.versions[d.versions.length - 1];
            return (
              <TableRow key={d.id} hover>
                <TableCell>{d.documentId}</TableCell>
                <TableCell><Chip size="small" label={d.documentType} /></TableCell>
                <TableCell>
                  {cur?.fileName}
                  {cur?.source === 'scan' && <Chip size="small" label="scan" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>{cur ? humanSize(cur.size) : '—'}</TableCell>
                <TableCell>{d.pageCount}</TableCell>
                <TableCell>v{d.currentVersion}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Preview">
                    <IconButton size="small" onClick={() => openPreview(d.id)}><Icon name="Visibility" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => download(d.id)}><Icon name="Download" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {preview?.name}
          <IconButton onClick={() => setPreview(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <Icon name="Close" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ height: '80vh' }}>
          {preview && (preview.mime === 'application/pdf' ? (
            <iframe title="preview" src={preview.url} style={{ width: '100%', height: '100%', border: 0 }} />
          ) : preview.mime.startsWith('image/') ? (
            <Stack alignItems="center">
              <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%' }} />
            </Stack>
          ) : (
            <Typography>
              Preview not available for this file type. <a href={preview.url} target="_blank" rel="noreferrer">Open in new tab</a>
            </Typography>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
