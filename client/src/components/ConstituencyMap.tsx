import { useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { api } from '@/api/client';

type Metric = 'total' | 'pending' | 'overdue';

interface WardCount {
  wardId: string;
  wardNumber: number | null;
  wardName: string;
  total: number;
  pending: number;
  overdue: number;
}
interface GeoFeature {
  type: 'Feature';
  properties: { wardNumber: number; code: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

const RAMP: Record<Metric, [string, string]> = {
  total: ['#e8eef9', '#0b3d91'],
  pending: ['#fff1e0', '#ed6c02'],
  overdue: ['#fde7e7', '#c62828'],
};

function lerpColor(a: string, b: string, t: number) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((x, i) => Math.round(x + (pb[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const W = 640;
const H = 440;

export function ConstituencyMap() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('pending');
  const [hover, setHover] = useState<{ x: number; y: number; ward: number } | null>(null);

  const geo = useQuery({
    queryKey: ['geo', 'wards'],
    queryFn: () => api.get('/geo/wards').then((r) => r.data as { features: GeoFeature[] }),
    staleTime: 24 * 3600 * 1000,
  });
  const counts = useQuery({
    queryKey: ['dashboard', 'geo'],
    queryFn: () => api.get('/dashboard/geo').then((r) => r.data as WardCount[]),
  });

  const byWard = useMemo(() => {
    const m = new Map<number, WardCount>();
    (counts.data ?? []).forEach((c) => c.wardNumber != null && m.set(c.wardNumber, c));
    return m;
  }, [counts.data]);

  const { paths, max } = useMemo(() => {
    const features = geo.data?.features ?? [];
    if (!features.length) return { paths: [] as { d: string; f: GeoFeature }[], max: 0 };
    const fc = { type: 'FeatureCollection', features } as never;
    const projection = geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], fc);
    const path = geoPath(projection);
    const m = Math.max(1, ...features.map((f) => byWard.get(f.properties.wardNumber)?.[metric] ?? 0));
    return {
      paths: features.map((f) => ({ d: path(f as never) ?? '', f })),
      max: m,
    };
  }, [geo.data, byWard, metric]);

  if (geo.isLoading) return <Skeleton variant="rounded" height={H + 90} />;
  if (geo.isError || !geo.data?.features?.length) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2">Constituency map</Typography>
          <Typography variant="body2" color="text.secondary">Ward boundaries are not available.</Typography>
        </CardContent>
      </Card>
    );
  }

  const [c0, c1] = RAMP[metric];
  const hoveredWard = hover ? byWard.get(hover.ward) : null;
  const hoveredName = hover
    ? hoveredWard?.wardName ?? geo.data.features.find((f) => f.properties.wardNumber === hover.ward)?.properties.code ?? `Ward ${hover.ward}`
    : '';

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle2">Requests by ward</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={metric}
            onChange={(_e, v) => v && setMetric(v)}
            sx={{ maxWidth: { sm: 320 } }}
          >
            <ToggleButton value="total">Total</ToggleButton>
            <ToggleButton value="pending">Pending</ToggleButton>
            <ToggleButton value="overdue">Overdue</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box sx={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {paths.map(({ d, f }) => {
              const wc = byWard.get(f.properties.wardNumber);
              const v = wc?.[metric] ?? 0;
              const fill = v === 0 ? '#f4f6fb' : lerpColor(c0, c1, Math.min(1, 0.15 + (v / max) * 0.85));
              return (
                <path
                  key={f.properties.code}
                  d={d}
                  fill={fill}
                  stroke="#9aa7bd"
                  strokeWidth={hover?.ward === f.properties.wardNumber ? 2 : 0.6}
                  style={{ cursor: wc ? 'pointer' : 'default', transition: 'stroke-width .1s' }}
                  onMouseMove={(e) => {
                    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setHover({
                      x: ((e.clientX - r.left) / r.width) * W,
                      y: ((e.clientY - r.top) / r.height) * H,
                      ward: f.properties.wardNumber,
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => wc && navigate(`/requests?wardId=${wc.wardId}`)}
                />
              );
            })}
          </svg>

          {hover && (
            <Box
              sx={{
                position: 'absolute',
                left: `${(hover.x / W) * 100}%`,
                top: `${(hover.y / H) * 100}%`,
                transform: 'translate(-50%, -115%)',
                bgcolor: 'rgba(26,34,51,0.95)',
                color: '#fff',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontSize: 12,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              <strong>W{hover.ward} · {hoveredName}</strong>
              <br />
              {hoveredWard
                ? `Total ${hoveredWard.total} · Pending ${hoveredWard.pending} · Overdue ${hoveredWard.overdue}`
                : 'No requests'}
            </Box>
          )}
        </Box>

        {/* legend */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">0</Typography>
          <Box
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 1,
              background: `linear-gradient(to right, #f4f6fb, ${lerpColor(c0, c1, 0.3)}, ${c1})`,
            }}
          />
          <Typography variant="caption" color="text.secondary">{max}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
