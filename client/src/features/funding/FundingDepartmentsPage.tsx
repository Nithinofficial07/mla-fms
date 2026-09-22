import { useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { useDepartments } from '@/hooks/useOptions';

/**
 * Entry point for a Funding request: pick which department's ministry it's
 * addressed to. One card per department, already alphabetical (useDepartments
 * sorts A-Z) - the ministry name (Government of Karnataka) shows underneath
 * when the department record has one set.
 */
export function FundingDepartmentsPage() {
  const navigate = useNavigate();
  const departments = useDepartments();
  const [search, setSearch] = useState('');

  const filtered = (departments.data ?? []).filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Box>
      <PageHeader
        title="Funding"
        subtitle="Pick a department to submit a funding request to its ministry"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Funding' }]}
      />

      <TextField
        size="small"
        placeholder="Search departments…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
        InputProps={{ startAdornment: <Icon name="Search" sx={{ mr: 1, opacity: 0.6 }} /> }}
      />

      {!departments.isLoading && filtered.length === 0 ? (
        <EmptyState icon="AccountBalance" title="No departments found" description="Try a different search." />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
          {filtered.map((d) => (
            <Card key={d.id}>
              <CardActionArea onClick={() => navigate(`/funding/new/${d.id}`)} sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                      <Icon name="AccountBalance" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                        {d.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={d.ministryName ? 'text.secondary' : 'text.disabled'}
                        sx={{ display: 'block', mt: 0.5, fontStyle: d.ministryName ? 'normal' : 'italic' }}
                      >
                        {d.ministryName || 'Ministry not set'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
