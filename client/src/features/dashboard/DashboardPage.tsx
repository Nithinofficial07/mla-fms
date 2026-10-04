import { useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, Card, CardContent, CardHeader, Skeleton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { ConstituencyMap } from '@/components/ConstituencyMap';
import { DataTable } from '@/components/DataTable';
import { DashboardRangeFilter, resolveRange, type RangeKey } from '@/components/DashboardRangeFilter';
import { StatusChip, PriorityChip, STATUS_COLORS } from '@/components/chips';
import { Icon } from '@/components/Icon';
import { RequestDetailDialog } from '@/features/requests/RequestDetailDialog';
import { MILESTONES, MILESTONE_COLORS, getMilestoneIndex } from '@/lib/milestones';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

dayjs.extend(relativeTime);

const LOCATION_COLORS: Record<string, string> = { ward: '#0D9488', gp: '#2563EB', other: '#C99700' };

function greeting(hour: number, t: (key: string) => string) {
  if (hour < 12) return t('dashboard.greetingMorning');
  if (hour < 17) return t('dashboard.greetingAfternoon');
  return t('dashboard.greetingEvening');
}

function requestLocationLabel(r: any): string {
  return r.location?.wardId?.name ?? r.location?.gramPanchayatId?.name
    ?? r.location?.otherLocationPlace ?? r.location?.otherPlaceName ?? r.location?.addressText ?? 'Not specified';
}

/** One cell of the bento grid. `md` is the 12-col span on desktop; sm/xs fall back wider. */
function Bento({ md, sm = 6, children }: { md: number; sm?: number; children: ReactNode }) {
  return (
    <Box sx={{ gridColumn: { xs: 'span 12', sm: `span ${sm}`, md: `span ${md}` } }}>
      {children}
    </Box>
  );
}

/** A single-request preview row for the Latest Request / Follow-up cards - applicant name + stage color, not just a count. */
function RequestPreviewCard({
  title, icon, color, loading, request, emptyText, onOpen,
}: {
  title: string;
  icon: string;
  color: string;
  loading?: boolean;
  request?: any;
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  return (
    <Card sx={{ height: '100%', cursor: request ? 'pointer' : 'default' }} onClick={() => request && onOpen(request.id)}>
      <CardContent sx={{ p: '12px !important' }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: request ? 1 : 0 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: `${color}18`, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={icon} fontSize="small" />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, fontSize: '0.66rem' }}>
            {title}
          </Typography>
        </Stack>
        {loading ? (
          <Skeleton height={44} />
        ) : !request ? (
          <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
        ) : (
          <Stack spacing={0.25}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" fontWeight={700} noWrap>{request.applicant?.name ?? '—'}</Typography>
              <StatusChip code={request.statusCode} label={request.statusId?.name} />
            </Stack>
            <Typography variant="body2" color="text.secondary" noWrap>{request.subject}</Typography>
            <Typography variant="caption" color="text.secondary">
              {requestLocationLabel(request)} · {dayjs(request.createdAt).fromNow()}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0];

  const tooltipProps = {
    contentStyle: {
      background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 10,
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
      color: theme.palette.text.primary,
      padding: '8px 12px',
    },
    labelStyle: { color: theme.palette.text.secondary, fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: theme.palette.text.primary, fontWeight: 600 },
  };

  const [detailId, setDetailId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('all');
  const { from, to, bucket } = resolveRange(range);
  const dateParams: Record<string, string> = { bucket };
  if (from) dateParams.from = from;
  if (to) dateParams.to = to;

  const stats = useQuery({ queryKey: ['dashboard', 'stats', dateParams], queryFn: () => api.get('/dashboard/stats', { params: dateParams }).then((r) => r.data) });
  const charts = useQuery({ queryKey: ['dashboard', 'charts', dateParams], queryFn: () => api.get('/dashboard/charts', { params: dateParams }).then((r) => r.data) });
  const recent = useQuery({ queryKey: ['dashboard', 'recent', dateParams], queryFn: () => api.get('/dashboard/recent', { params: { ...dateParams, limit: 10 } }).then((r) => r.data) });
  const latest = useQuery({ queryKey: ['dashboard', 'latest', dateParams], queryFn: () => api.get('/dashboard/recent', { params: { ...dateParams, limit: 1 } }).then((r) => r.data[0]) });
  const followUpPreview = useQuery({
    queryKey: ['dashboard', 'followup-preview', dateParams],
    queryFn: () => api.get('/dashboard/recent', { params: { ...dateParams, limit: 1, statusCode: 'AWAITING_INFO,DEPT_RESPONSE' } }).then((r) => r.data[0]),
  });

  const s = stats.data ?? {};

  const topRow = [
    { label: t('dashboard.totalFiles'), key: 'totalFiles', icon: 'FolderCopy', color: '#0A2540', to: '/requests' },
    { label: 'Week Requests', key: 'weekRequests', icon: 'Event', color: '#2563EB', to: '/requests' },
    { label: t('dashboard.todaysInflow'), key: 'todayRequests', icon: 'Today', color: '#0284C7', to: '/requests' },
    { label: 'Follow-up', key: 'followUp', icon: 'Flag', color: '#D97706', to: '/requests?statusCode=AWAITING_INFO,DEPT_RESPONSE' },
  ];

  const tertiary = [
    { label: t('dashboard.overdue'), key: 'overdue', icon: 'ReportProblem', color: '#DC2626', to: '/requests?overdue=true' },
    { label: t('dashboard.urgent'), key: 'urgent', icon: 'PriorityHigh', color: '#B91C1C', to: '/requests' },
    { label: t('dashboard.deptPending'), key: 'departmentPending', icon: 'AccountBalance', color: '#475569', to: '/requests?bucket=pending' },
    { label: t('dashboard.rejected'), key: 'rejected', icon: 'Cancel', color: '#B71C1C', to: '/requests?statusCode=REJECTED' },
  ];

  // Stage 1-5 counts, derived client-side from the per-status counts already
  // in charts.byStatus (no extra backend call) via the same milestone
  // grouping used on the request detail page's stepper. REJECTED is tracked
  // separately (the Rejected card above), not folded into a stage.
  const byStatus: { label: string; value: number }[] = charts.data?.byStatus ?? [];
  const stageCounts = MILESTONES.map(() => 0);
  byStatus.forEach((r) => {
    if (r.label === 'REJECTED') return;
    stageCounts[getMilestoneIndex(r.label)] += r.value;
  });

  const recentColumns = [
    { field: 'fileId', headerName: 'File ID', width: 160 },
    { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 200 },
    {
      field: 'department', headerName: 'Department', width: 180,
      valueGetter: (_v: unknown, row: any) => row.primaryDepartmentId?.name ?? 'Unassigned',
    },
    {
      field: 'priority', headerName: 'Priority', width: 120,
      renderCell: (p: any) => <PriorityChip code={p.row.priorityId?.code} label={p.row.priorityId?.name} />,
    },
    {
      field: 'status', headerName: 'Status', width: 150,
      renderCell: (p: any) => <StatusChip code={p.row.statusCode} label={p.row.statusId?.name} />,
    },
  ];

  const hasUrgentAttention = (s.overdue ?? 0) > 0 || (s.urgent ?? 0) > 0;

  return (
    <Box>
      <PageHeader
        title={firstName ? `${greeting(new Date().getHours(), t)}, ${firstName}` : t('dashboard.title')}
        subtitle={`${t('dashboard.subtitle')} · Today: ${dayjs().format('DD MMM YYYY')}, ${dayjs().format('dddd')}`}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Icon name="Tune" />}
              onClick={() => navigate('/requests')}
            >
              {t('dashboard.allFiles')}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Icon name="Add" />}
              onClick={() => navigate('/requests/new')}
            >
              {t('dashboard.newRequest')}
            </Button>
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2.5 }}>
        <DashboardRangeFilter value={range} onChange={setRange} />
      </Stack>

      {/* Needs Immediate Attention (Priority Triage) Banner */}
      {hasUrgentAttention && (
        <Card
          sx={{
            mb: 2.5,
            borderLeft: '4px solid #DC2626',
            background: isDark
              ? 'linear-gradient(90deg, rgba(220, 38, 38, 0.14) 0%, rgba(17, 24, 39, 0) 100%)'
              : 'linear-gradient(90deg, rgba(254, 242, 242, 0.9) 0%, rgba(255, 255, 255, 0.5) 100%)',
          }}
        >
          <CardContent sx={{ py: 1.5, px: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(220, 38, 38, 0.15)',
                    color: '#DC2626',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    animation: 'pulseGlow 2s infinite ease-in-out',
                  }}
                >
                  <Icon name="ReportProblem" fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="error.main">
                    Action Required: Priority Triage Needed
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.overdue ?? 0} request(s) have exceeded SLA limits and {s.urgent ?? 0} urgent matter(s) require officer dispatch.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                {(s.overdue ?? 0) > 0 && (
                  <Button size="small" variant="contained" color="error" onClick={() => navigate('/requests?overdue=true')}>
                    View Overdue ({s.overdue})
                  </Button>
                )}
                {(s.urgent ?? 0) > 0 && (
                  <Button size="small" variant="outlined" color="error" onClick={() => navigate('/requests')}>
                    Urgent Files ({s.urgent})
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Bento grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 1.5 }}>
        {topRow.map((c) => (
          <Bento key={c.key} md={3}>
            <StatCard dense label={c.label} value={s[c.key]} icon={c.icon} color={c.color} loading={stats.isLoading} onClick={() => navigate(c.to)} />
          </Bento>
        ))}

        <Bento md={6}>
          <RequestPreviewCard
            title="Latest Request"
            icon="Inbox"
            color="#2563EB"
            loading={latest.isLoading}
            request={latest.data}
            emptyText="No requests yet"
            onOpen={setDetailId}
          />
        </Bento>
        <Bento md={6}>
          <RequestPreviewCard
            title="Needs Follow-up"
            icon="Flag"
            color="#D97706"
            loading={followUpPreview.isLoading}
            request={followUpPreview.data}
            emptyText="Nothing waiting on a follow-up"
            onOpen={setDetailId}
          />
        </Bento>

        {MILESTONES.map((m, i) => (
          <Bento key={m.key} md={2} sm={4}>
            <StatCard
              dense
              label={`Stage ${i + 1}: ${m.label}`}
              value={stageCounts[i]}
              icon={m.icon}
              color={MILESTONE_COLORS[i]}
              loading={charts.isLoading}
              onClick={() => navigate(`/requests?statusCode=${m.codes.join(',')}`)}
            />
          </Bento>
        ))}

        {tertiary.map((c) => (
          <Bento key={c.key} md={3}>
            <StatCard dense label={c.label} value={s[c.key]} icon={c.icon} color={c.color} loading={stats.isLoading} onClick={() => navigate(c.to)} />
          </Bento>
        ))}

        {/* Charts Section */}
        <Bento md={8}>
          <ChartCard title="Department-wise Caseload" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.byDepartment ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="deptBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0A2540" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="label" hide />
                <YAxis allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <Tooltip {...tooltipProps} />
                <Bar
                  dataKey="value"
                  fill="url(#deptBarGradient)"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(d: any) => {
                    const id = d?.id ?? d?.payload?.id;
                    if (id) navigate(`/requests?departmentId=${id}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>

        <Bento md={4}>
          <ChartCard title="Request Status Breakdown" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.data?.byStatus ?? []}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {(charts.data?.byStatus ?? []).map((r: { label: string }, i: number) => (
                    <Cell key={i} fill={STATUS_COLORS[r.label] ?? '#64748B'} stroke={theme.palette.background.paper} strokeWidth={2} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.78rem' }} />
                <Tooltip {...tooltipProps} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>

        <Bento md={6}>
          <ChartCard title="Monthly Inflow & Trajectory" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.data?.monthly ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="monthAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C99700" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#C99700" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <Tooltip {...tooltipProps} />
                <Area type="monotone" dataKey="value" stroke="#C99700" strokeWidth={2.5} fill="url(#monthAreaGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>

        <Bento md={6}>
          <ChartCard title="Location-Based Tracking" loading={charts.isLoading}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.data?.byLocation ?? []} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} />
                    <Tooltip {...tooltipProps} />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(d: any) => {
                        const row = d?.payload ?? d;
                        if (row?.kind === 'ward' && row?.id) navigate(`/requests?wardId=${row.id}`);
                        else if (row?.kind === 'gp' && row?.id) navigate(`/requests?gramPanchayatId=${row.id}`);
                      }}
                    >
                      {(charts.data?.byLocation ?? []).map((r: { kind: string }, i: number) => (
                        <Cell key={i} fill={LOCATION_COLORS[r.kind] ?? '#64748B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              {!!charts.data?.notSpecified && (
                <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
                  {charts.data.notSpecified} request(s) with no location recorded (not specified).
                </Typography>
              )}
            </Box>
          </ChartCard>
        </Bento>

        <Bento md={12}>
          <ConstituencyMap />
        </Bento>

        <Bento md={12}>
          <Card>
            <CardHeader
              title={t('dashboard.recentRequests')}
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
              action={
                <Button size="small" endIcon={<Icon name="ArrowForward" />} onClick={() => navigate('/requests')}>
                  {t('dashboard.viewAll')}
                </Button>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              <DataTable
                rows={recent.data ?? []}
                columns={recentColumns as never}
                loading={recent.isLoading}
                rowCount={recent.data?.length ?? 0}
                hideFooter
                onRowClick={(p) => setDetailId(String(p.id))}
                sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              />
            </CardContent>
          </Card>
        </Bento>
      </Box>

      <RequestDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </Box>
  );
}
