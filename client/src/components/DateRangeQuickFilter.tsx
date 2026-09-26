import { useState } from 'react';
import { Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import dayjs from 'dayjs';

type Mode = 'today' | 'other' | null;

/**
 * A "Today" / "Other" toggle instead of always-visible From/To fields.
 * "Today" applies the current local day immediately; "Other" reveals native
 * date inputs (clicking one opens the browser's own calendar picker).
 * Reports back full-day ISO instants so the day's end isn't cut off at
 * midnight on the server side.
 */
export function DateRangeQuickFilter({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(from || to ? 'other' : null);
  const [customFrom, setCustomFrom] = useState(from ? from.slice(0, 10) : '');
  const [customTo, setCustomTo] = useState(to ? to.slice(0, 10) : '');

  const applyCustom = (nextFrom: string, nextTo: string) => {
    setCustomFrom(nextFrom);
    setCustomTo(nextTo);
    onApply(
      nextFrom ? dayjs(nextFrom).startOf('day').toISOString() : '',
      nextTo ? dayjs(nextTo).endOf('day').toISOString() : '',
    );
  };

  const handleModeChange = (_e: unknown, next: Mode) => {
    if (!next) {
      setMode(null);
      setCustomFrom('');
      setCustomTo('');
      onApply('', '');
      return;
    }
    if (next === 'today') {
      setMode('today');
      setCustomFrom('');
      setCustomTo('');
      onApply(dayjs().startOf('day').toISOString(), dayjs().endOf('day').toISOString());
      return;
    }
    setMode('other');
  };

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      <ToggleButtonGroup size="small" exclusive value={mode} onChange={handleModeChange}>
        <ToggleButton value="today">Today</ToggleButton>
        <ToggleButton value="other">Other</ToggleButton>
      </ToggleButtonGroup>
      {mode === 'other' && (
        <Stack direction="row" spacing={1}>
          <TextField
            type="date"
            size="small"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={customFrom}
            onChange={(e) => applyCustom(e.target.value, customTo)}
          />
          <TextField
            type="date"
            size="small"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={customTo}
            onChange={(e) => applyCustom(customFrom, e.target.value)}
          />
        </Stack>
      )}
    </Stack>
  );
}
