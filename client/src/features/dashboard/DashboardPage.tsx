import { useState } from 'react';
import { Grid, Box, Card, CardContent, CardHeader } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { ConstituencyMap } from '@/components/ConstituencyMap';
import { DataTable } from '@/components/DataTable';
import { StatusChip, PriorityChip } from '@/components/chips';
import { RequestQuickView } from '@/features/requests/RequestQuickView';
import { api } from '@/api/client';

const PIE_COLORS = ['#4F46E5', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#8B5CF6', '#F97316', '#14B8A6'];

export function DashboardPage() {
  const navigate = useNavigate();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => api.get('/dashboard/stats').then((r) => r.data) });
  const charts = useQuery({ queryKey: ['dashboard', 'charts'], queryFn: () => api.get('/dashboard/charts').then((r) => r.data) });
  const recent = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: () => api.get('/dashboard/recent').then((r) => r.data) });

  const s = stats.data ?? {};
  const cards = [
    { label: 'Total Files', key: 'totalFiles', icon: 'FolderCopy', color: '#4F46E5', to: '/requests' },
    { label: 'New Requests', key: 'newRequests', icon: 'FiberNew', color: '#0EA5E9', to: '/requests?statusCode=SUBMITTED' },
    { label: 'Pending', key: 'pending', icon: 'HourglassEmpty', color: '#F59E0B', to: '/requests?bucket=pending' },
    { label: 'In Progress', key: 'inProgress', icon: 'Autorenew', color: '#8B5CF6', to: '/requests?bucket=in-progress' },
    { label: 'Completed', key: 'completed', icon: 'TaskAlt', color: '#10B981', to: '/requests?bucket=completed' },
    { label: 'Rejected', key: 'rejected', icon: 'Cancel', color: '#E11D48', to: '/requests?statusCode=REJECTED' },
    { label: 'Overdue', key: 'overdue', icon: 'ReportProblem', color: '#F43F5E', to: '/requests?overdue=true' },
    { label: 'Urgent', key: 'urgent', icon: 'PriorityHigh', color: '#EC4899', to: '/requests' },
    { label: 'Dept Pending', key: 'departmentPending', icon: 'AccountBalance', color: '#14B8A6', to: '/requests?bucket=pending' },
    { label: "Today's Requests", key: 'todayRequests', icon: 'Today', color: '#6366F1', to: '/requests' },
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

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Live overview of constituency requests and files" />

      <Grid container spacing={2}>
        {cards.map((c) => (
          <Grid key={c.key} item xs={6} sm={4} md={2.4}>
            <StatCard
              label={c.label}
              value={s[c.key]}
              icon={c.icon}
              color={c.color}
              loading={stats.isLoading}
              onClick={() => navigate(c.to)}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={7}>
          <ChartCard title="Department-wise Requests" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.byDepartment ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={5}>
          <ChartCard title="Request Status" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.data?.byStatus ?? []} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90}>
                  {(charts.data?.byStatus ?? []).map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Monthly Requests" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.data?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#EC4899" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Ward-wise Requests" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.byWard ?? []} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <ConstituencyMap />
      </Box>

      <Card sx={{ mt: 2 }}>
        <CardHeader title="Recent Requests" titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }} />
        <CardContent>
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

      <RequestQuickView id={quickViewId} onClose={() => setQuickViewId(null)} />
    </Box>
  );
}
