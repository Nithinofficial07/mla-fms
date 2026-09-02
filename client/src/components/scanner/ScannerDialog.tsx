import { forwardRef, useCallback, useEffect, useRef, useState, type ReactElement, type Ref } from 'react';
import {
  AppBar, Box, Button, Dialog, IconButton, Slide, Stack, Toolbar, Typography, Alert,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import { jsPDF } from 'jspdf';
import { Icon } from '@/components/Icon';

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children: ReactElement },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface Page {
  id: string;
  dataUrl: string;
  rotation: number;
}

/**
 * In-app document scanner. Uses the device camera (rear-facing where available),
 * captures multiple pages, supports rotate / delete / reorder, then assembles a
 * single PDF client-side and hands it back as a File. Falls back to a file input
 * (capture=environment) when getUserMedia is unavailable.
 */
export function ScannerDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (pdf: File, pageCount: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setError('Camera unavailable. Use "Add from file" to pick photos instead.');
    }
  }, []);

  useEffect(() => {
    if (open) startCamera();
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setPages((p) => [...p, { id: crypto.randomUUID(), dataUrl: canvas.toDataURL('image/jpeg', 0.9), rotation: 0 }]);
  };

  const addFromFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () =>
        setPages((p) => [...p, { id: crypto.randomUUID(), dataUrl: String(reader.result), rotation: 0 }]);
      reader.readAsDataURL(file);
    });
  };

  const rotate = (id: string) =>
    setPages((p) => p.map((pg) => (pg.id === id ? { ...pg, rotation: (pg.rotation + 90) % 360 } : pg)));
  const remove = (id: string) => setPages((p) => p.filter((pg) => pg.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setPages((p) => {
      const i = p.findIndex((pg) => pg.id === id);
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const copy = [...p];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const generatePdf = async () => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const img = new Image();
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
        img.src = page.dataUrl;
      });
      const rotated = page.rotation % 180 !== 0;
      const iw = rotated ? img.height : img.width;
      const ih = rotated ? img.width : img.height;
      const scale = Math.min(pw / iw, ph / ih);
      const w = iw * scale;
      const h = ih * scale;
      if (i > 0) pdf.addPage();
      // draw via canvas to bake rotation
      const canvas = document.createElement('canvas');
      canvas.width = iw;
      canvas.height = ih;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(iw / 2, ih / 2);
      ctx.rotate((page.rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
    }
    const blob = pdf.output('blob');
    const file = new File([blob], `scan-${Date.now()}.pdf`, { type: 'application/pdf' });
    onComplete(file, pages.length);
    setPages([]);
    onClose();
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={Transition}>
      <AppBar sx={{ position: 'relative' }} color="default">
        <Toolbar>
          <IconButton edge="start" onClick={onClose}>
            <Icon name="ArrowBack" />
          </IconButton>
          <Typography sx={{ ml: 1, flex: 1 }} variant="h6">
            Scan Document
          </Typography>
          <Button
            variant="contained"
            disabled={!pages.length}
            onClick={generatePdf}
            startIcon={<Icon name="PictureAsPdf" />}
          >
            Generate PDF ({pages.length})
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden', aspectRatio: '16/10', maxWidth: 900, mx: 'auto' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </Box>

        <Stack direction="row" spacing={1} justifyContent="center" sx={{ my: 2 }}>
          <Button variant="contained" size="large" onClick={capture} disabled={!cameraReady} startIcon={<Icon name="CameraAlt" />}>
            Capture
          </Button>
          <Button component="label" variant="outlined" startIcon={<Icon name="PhotoLibrary" />}>
            Add from file
            <input hidden type="file" accept="image/*" capture="environment" multiple onChange={(e) => addFromFiles(e.target.files)} />
          </Button>
          {!cameraReady && <Button onClick={startCamera} startIcon={<Icon name="Videocam" />}>Retry camera</Button>}
        </Stack>

        <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
          {pages.map((pg, i) => (
            <Box key={pg.id} sx={{ minWidth: 140, textAlign: 'center' }}>
              <Box
                component="img"
                src={pg.dataUrl}
                sx={{ width: 140, height: 180, objectFit: 'cover', borderRadius: 1, border: '1px solid #ddd', transform: `rotate(${pg.rotation}deg)` }}
              />
              <Typography variant="caption">Page {i + 1}</Typography>
              <Stack direction="row" justifyContent="center">
                <IconButton size="small" onClick={() => move(pg.id, -1)}><Icon name="ChevronLeft" /></IconButton>
                <IconButton size="small" onClick={() => rotate(pg.id)}><Icon name="Rotate90DegreesCw" /></IconButton>
                <IconButton size="small" color="error" onClick={() => remove(pg.id)}><Icon name="Delete" /></IconButton>
                <IconButton size="small" onClick={() => move(pg.id, 1)}><Icon name="ChevronRight" /></IconButton>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Dialog>
  );
}
