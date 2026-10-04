import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import dayjs from 'dayjs';

export type RangeKey = 'day' | 'week' | 'month' | 'all';

export interface DashboardRange {
  from: string;
  to: string;
  bucket: 'day' | 'month';
}

/** Resolves a quick-range key to concrete ISO bounds + trend-chart bucket size. */
export function resolveRange(key: RangeKey): DashboardRange {
  const now = dayjs();
  switch (key) {
    case 'day':
      return { from: now.startOf('day').toISOString(), to: now.endOf('day').toISOString(), bucket: 'day' };
    case 'week':
      return { from: now.subtract(6, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString(), bucket: 'day' };
    case 'month':
      return { from: now.startOf('month').toISOString(), to: now.endOf('day').toISOString(), bucket: 'day' };
    case 'all':
    default:
      return { from: '', to: '', bucket: 'month' };
  }
}

/**
 * Day / Week / Month / All quick-range toggle for the dashboard's analytics.
 * Distinct from `DateRangeQuickFilter` (Today / Other), which stays as-is on
 * the Requests list — this one drives `scope()`'s from/to plus a `bucket`
 * hint for the Monthly Inflow chart's granularity.
 */
export function DashboardRangeFilter({ value, onChange }: { value: RangeKey; onChange: (key: RangeKey) => void }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_e, next) => next && onChange(next)}
    >
      <ToggleButton value="day">Day</ToggleButton>
      <ToggleButton value="week">Week</ToggleButton>
      <ToggleButton value="month">Month</ToggleButton>
      <ToggleButton value="all">All</ToggleButton>
    </ToggleButtonGroup>
  );
}
