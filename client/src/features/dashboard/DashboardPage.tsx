import { useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Card, CardContent, CardHeader } from '@mui/material';
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

const PIE_COLORS = ['#0B3450', '#B8860B', '#1565C0', '#2E7D32', '#6D4C41', '#00695C', '#E65100', '#455A64'];

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
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => api.get('/dashboard/stats').then((r) => r.data) });
  const charts = useQuery({ queryKey: ['dashboard', 'charts'], queryFn: () => api.get('/dashboard/charts').then((r) => r.data) });
  const recent = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: () => api.get('/dashboard/recent').then((r) => r.data) });

  const s = stats.data ?? {};
  const hero = [
    { label: 'Total Files', key: 'totalFiles', icon: 'FolderCopy', color: '#0B3450', to: '/requests' },
    { label: 'New Requests', key: 'newRequests', icon: 'FiberNew', color: '#1565C0', to: '/requests?statusCode=SUBMITTED' },
    { label: "Today's Requests", key: 'todayRequests', icon: 'Today', color: '#0277BD', to: '/requests' },
  ];
  const secondary = [
    { label: 'Pending', key: 'pending', icon: 'HourglassEmpty', color: '#B8860B', to: '/requests?bucket=pending' },
    { label: 'In Progress', key: 'inProgress', icon: 'Autorenew', color: '#00695C', to: '/requests?bucket=in-progress' },
    { label: 'Completed', key: 'completed', icon: 'TaskAlt', color: '#2E7D32', to: '/requests?bucket=completed' },
    { label: 'Rejected', key: 'rejected', icon: 'Cancel', color: '#B71C1C', to: '/requests?statusCode=REJECTED' },
  ];
  const tertiary = [
    { label: 'Overdue', key: 'overdue', icon: 'ReportProblem', color: '#D84315', to: '/requests?overdue=true' },
    { label: 'Urgent', key: 'urgent', icon: 'PriorityHigh', color: '#7B241C', to: '/requests' },
    { label: 'Dept Pending', key: 'departmentPending', icon: 'AccountBalance', color: '#455A64', to: '/requests?bucket=pending' },
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

      {/* Bento grid: varied tile widths instead of a uniform row/column layout. */}
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

        <Bento md={8}>
          <ChartCard title="Department-wise Requests" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.byDepartment ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0B3450" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>
        <Bento md={4}>
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
        </Bento>

        <Bento md={6}>
          <ChartCard title="Monthly Requests" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.data?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#B8860B" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>
        <Bento md={6}>
          <ChartCard title="Ward-wise Requests" loading={charts.isLoading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.byWard ?? []} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#00695C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Bento>

        <Bento md={12}>
          <ConstituencyMap />
        </Bento>

        <Bento md={12}>
          <Card>
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
        </Bento>
      </Box>

      <RequestQuickView id={quickViewId} onClose={() => setQuickViewId(null)} />
    </Box>
  );
}
