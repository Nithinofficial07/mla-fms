import { useEffect, useMemo, useRef } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { WORK_PHOTO_LIMIT } from '@mla/shared';
import { Icon } from '@/components/Icon';

/**
 * Up to WORK_PHOTO_LIMIT local photos picked before the work exists, shown as
 * thumbnails with a remove button. Nothing is uploaded here - the create page
 * posts them once the work has an id.
 */
export function PhotoSlots({ label, files, onChange }: { label: string; files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (picked: FileList | null) => {
    const images = Array.from(picked ?? []).filter((f) => f.type.startsWith('image/'));
    onChange([...files, ...images].slice(0, WORK_PHOTO_LIMIT));
  };

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {label} <Typography component="span" variant="caption" color="text.secondary">({files.length}/{WORK_PHOTO_LIMIT})</Typography>
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {urls.map((u, i) => (
          <Box key={u} sx={{ position: 'relative', width: 96, height: 96, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <Box component="img" src={u} alt={files[i].name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <Tooltip title="Remove">
              <IconButton
                size="small"
                onClick={() => onChange(files.filter((_f, j) => j !== i))}
                sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
              >
                <Icon name="Close" fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
        {files.length < WORK_PHOTO_LIMIT && (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            sx={{
              width: 96, height: 96, borderRadius: 1, border: '2px dashed', borderColor: 'divider', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            <Icon name="PhotoCamera" />
            <Typography variant="caption">Add photo</Typography>
          </Box>
        )}
      </Stack>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => { add(e.target.files); e.target.value = ''; }}
      />
    </Box>
  );
}
