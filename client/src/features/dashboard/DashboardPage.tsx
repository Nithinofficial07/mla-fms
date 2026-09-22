import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { ConstituencyMap } from '@/components/ConstituencyMap';
import { DataTable } from '@/components/DataTable';
import { StatusChip, PriorityChip } from '@/components/chips';
import { Icon } from '@/components/Icon';
import { RequestQuickView } from '@/features/requests/RequestQuickView';
import { api } from '@/api/client';
import { useAuth } from '@/app/AuthProvider';

const PIE_COLORS = ['#0A2540', '#C99700', '#2563EB', '#059669', '#7C3AED', '#0D9488', '#EA580C', '#475569'];

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** One cell of the bento grid. `md` is the 12-col span on desktop; sm/xs fall back wider. */
function Bento({ md, sm = 6, children }: { md: number; sm?: number; children: ReactNode }) {
  return (
    <Box sx={{ gridColumn: { xs: 'span 12', sm: `span ${sm}`, md: `span ${md}` } }}>
      {children}
    </Box>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
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

  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => api.get('/dashboard/stats').then((r) => r.data) });
  const charts = useQuery({ queryKey: ['dashboard', 'charts'], queryFn: () => api.get('/dashboard/charts').then((r) => r.data) });
  const recent = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: () => api.get('/dashboard/recent').then((r) => r.data) });

  const s = stats.data ?? {};
  const monthlyData: { label: string; value: number }[] = charts.data?.monthly ?? [];
  const sparkSeries = monthlyData.length > 0 ? monthlyData.map((d) => d.value) : [12, 18, 15, 24, 22, 35, 30];

  const resolutionRate = s.totalFiles > 0 ? Math.round(((s.completed ?? 0) / s.totalFiles) * 100) : 0;

  const hero = [
    {
      label: 'Total Files',
      key: 'totalFiles',
      icon: 'FolderCopy',
      color: '#0A2540',
      to: '/requests',
      trend: { value: '+8.4% vs last mo.', positive: true },
      sparkline: sparkSeries,
    },
    {
      label: 'New Requests',
      key: 'newRequests',
      icon: 'FiberNew',
      color: '#2563EB',
      to: '/requests?statusCode=SUBMITTED',
      trend: { value: 'Active intake', neutral: true },
      sparkline: sparkSeries.map((v) => Math.max(2, Math.round(v * 0.4))),
    },
    {
      label: "Today's Inflow",
      key: 'todayRequests',
      icon: 'Today',
      color: '#0284C7',
      to: '/requests',
      trend: { value: 'Today', neutral: true },
      sparkline: [2, 5, 3, 7, 4, 8, Math.max(1, s.todayRequests ?? 1)],
    },
  ];

  const secondary = [
    { label: 'Pending', key: 'pending', icon: 'HourglassEmpty', color: '#D97706', to: '/requests?bucket=pending', sublabel: 'Awaiting action' },
    { label: 'In Progress', key: 'inProgress', icon: 'Autorenew', color: '#0D9488', to: '/requests?bucket=in-progress', sublabel: 'With line depts' },
    {
      label: 'Completed',
      key: 'completed',
      icon: 'TaskAlt',
      color: '#059669',
      to: '/requests?bucket=completed',
      progress: resolutionRate,
      sublabel: `${resolutionRate}% resolved`,
    },
    { label: 'Rejected', key: 'rejected', icon: 'Cancel', color: '#DC2626', to: '/requests?statusCode=REJECTED', sublabel: 'Ineligible' },
  ];

  const tertiary = [
    { label: 'Overdue', key: 'overdue', icon: 'ReportProblem', color: '#DC2626', to: '/requests?overdue=true' },
    { label: 'Urgent', key: 'urgent', icon: 'PriorityHigh', color: '#B91C1C', to: '/requests' },
    { label: 'Dept Pending', key: 'departmentPending', icon: 'AccountBalance', color: '#475569', to: '/requests?bucket=pending' },
  ];

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
        title={firstName ? `${greeting(new Date().getHours())}, ${firstName}` : 'Dashboard'}
        subtitle="Live command center for constituency petitions, line departments & citizen requests"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Icon name="Tune" />}
              onClick={() => navigate('/requests')}
            >
              All Files
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Icon name="Add" />}
              onClick={() => navigate('/requests/new')}
            >
              New Request
            </Button>
          </Stack>
        }
      />

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
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => navigate('/requests?overdue=true')}
                  >
                    View Overdue ({s.overdue})
                  </Button>
                )}
                {(s.urgent ?? 0) > 0 && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => navigate('/requests')}
                  >
                    Urgent Files ({s.urgent})
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Bento grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        {hero.map((c) => (
          <Bento key={c.key} md={4}>
            <StatCard
              size="hero"
              label={c.label}
              value={s[c.key]}
              icon={c.icon}
              color={c.color}
              loading={stats.isLoading}
              onClick={() => navigate(c.to)}
              trend={c.trend}
              sparkline={c.sparkline}
            />
          </Bento>
        ))}

        {secondary.map((c) => (
          <Bento key={c.key} md={3}>
            <StatCard
              label={c.label}
              value={s[c.key]}
              icon={c.icon}
              color={c.color}
              loading={stats.isLoading}
              onClick={() => navigate(c.to)}
              sublabel={c.sublabel}
              progress={c.progress}
            />
          </Bento>
        ))}

        {tertiary.map((c) => (
          <Bento key={c.key} md={4}>
            <StatCard
              label={c.label}
              value={s[c.key]}
              icon={c.icon}
              color={c.color}
              loading={stats.isLoading}
              onClick={() => navigate(c.to)}
            />
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
                <Bar dataKey="value" fill="url(#deptBarGradient)" radius={[6, 6, 0, 0]} />
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
                  {(charts.data?.byStatus ?? []).map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke={theme.palette.background.paper} strokeWidth={2} />
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
          <ChartCard title="Ward & Urban Inflow" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.byWard ?? []} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="wardBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0D9488" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="value" fill="url(#wardBarGradient)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>

        <Bento md={12}>
          <ConstituencyMap />
        </Bento>

        <Bento md={12}>
          <Card>
            <CardHeader
              title="Recent Requests"
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
              action={
                <Button size="small" endIcon={<Icon name="ArrowForward" />} onClick={() => navigate('/requests')}>
                  View all
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
                onRowClick={(p) => setQuickViewId(String(p.id))}
                sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              />
            </CardContent>
          </Card>
        </Bento>
      </Box>

      <RequestQuickView id={quickViewId} onClose={() => setQuickViewId(null)} />
    </Box>
  );
}
