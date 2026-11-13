import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  Avatar, AvatarGroup, Box, Button, ButtonBase, Chip, Divider, ListItemIcon, ListSubheader, Menu, MenuItem, Popover, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TEAMS, taskForColor, taskForMeta, taskPriorityMeta, taskStatusMeta } from '@mla/shared';
import { Icon } from '@/components/Icon';
import { addDays, initials, type Member } from './tasksApi';

export function MemberAvatar({ m, size = 26 }: { m?: Member; size?: number }) {
  return (
    <Tooltip title={m ? `${m.name} · ${m.role}` : 'Removed'}>
      <Avatar sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 700, bgcolor: m ? taskForColor(m.team) : '#64748B' }}>
        {initials(m?.name ?? '?')}
      </Avatar>
    </Tooltip>
  );
}

export function AvatarStack({ people, max = 4, size = 26 }: { people: (Member | undefined)[]; max?: number; size?: number }) {
  const list = people.filter(Boolean) as Member[];
  if (!list.length) return <Typography variant="body2" color="text.disabled">—</Typography>;
  return (
    <AvatarGroup max={max} sx={{ '& .MuiAvatar-root': { width: size, height: size, fontSize: size * 0.4, borderWidth: 2 } }}>
      {list.map((m) => <Avatar key={m.id} title={`${m.name} · ${m.role}`} sx={{ bgcolor: taskForColor(m.team), fontWeight: 700 }}>{initials(m.name)}</Avatar>)}
    </AvatarGroup>
  );
}

export function ForChip({ code, small }: { code: string; small?: boolean }) {
  const f = taskForMeta(code);
  if (!f) return <Typography variant="caption" color="text.secondary">Office</Typography>;
  return <Chip size="small" label={f.short} sx={{ bgcolor: f.color, color: '#fff', fontWeight: 700, height: small ? 20 : 22, fontSize: 11.5 }} />;
}

export function StatusPill({ status, onClick, height = 26, full }: { status: string; onClick?: (e: MouseEvent<HTMLElement>) => void; height?: number; full?: boolean }) {
  const s = taskStatusMeta(status);
  return (
    <ButtonBase
      onClick={onClick} disabled={!onClick}
      sx={{ bgcolor: s.color, color: '#fff', fontWeight: 600, fontSize: 12.5, height, px: 1.25, borderRadius: full ? 0 : 1.5, width: full ? '100%' : undefined, whiteSpace: 'nowrap', '&:hover': { filter: 'brightness(1.08)' } }}
    >
      {s.label}
    </ButtonBase>
  );
}

export function PriorityPill({ priority, onClick, height = 26, full }: { priority: string; onClick?: (e: MouseEvent<HTMLElement>) => void; height?: number; full?: boolean }) {
  const p = taskPriorityMeta(priority);
  return (
    <ButtonBase
      onClick={onClick} disabled={!onClick}
      sx={{ bgcolor: p?.color ?? 'transparent', color: p ? '#fff' : 'text.disabled', fontWeight: 600, fontSize: 12.5, height, px: 1.25, borderRadius: full ? 0 : 1.5, width: full ? '100%' : undefined, '&:hover': { filter: 'brightness(1.08)' } }}
    >
      {p?.label ?? '—'}
    </ButtonBase>
  );
}

/** Menu of coloured status buttons. */
export function StatusMenu({ anchor, onClose, onPick }: { anchor: HTMLElement | null; onClose: () => void; onPick: (code: string) => void }) {
  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose} MenuListProps={{ sx: { p: 0.75, minWidth: 190 } }}>
      {TASK_STATUSES.map((s) => (
        <MenuItem key={s.code} onClick={() => { onClose(); onPick(s.code); }} sx={{ bgcolor: s.color, color: '#fff', justifyContent: 'center', fontWeight: 600, borderRadius: 1, mb: 0.5, '&:hover': { bgcolor: s.color, filter: 'brightness(1.08)' } }}>
          {s.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

export function PriorityMenu({ anchor, onClose, onPick }: { anchor: HTMLElement | null; onClose: () => void; onPick: (code: string) => void }) {
  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose} MenuListProps={{ sx: { p: 0.75, minWidth: 170 } }}>
      {TASK_PRIORITIES.map((p) => (
        <MenuItem key={p.code} onClick={() => { onClose(); onPick(p.code); }} sx={{ bgcolor: p.color, color: '#fff', justifyContent: 'center', fontWeight: 600, borderRadius: 1, mb: 0.5, '&:hover': { bgcolor: p.color, filter: 'brightness(1.08)' } }}>
          {p.label}
        </MenuItem>
      ))}
      <MenuItem onClick={() => { onClose(); onPick(''); }} sx={{ justifyContent: 'center' }}>— None</MenuItem>
    </Menu>
  );
}

/** People grouped by team; ticks show who is already on it. */
export function PeopleMenu({ anchor, onClose, members, selected, onPick }: { anchor: HTMLElement | null; onClose: () => void; members: Member[]; selected?: string[]; onPick: (id: string) => void }) {
  const items: ReactNode[] = [];
  TASK_TEAMS.forEach((t) => {
    const ms = members.filter((m) => m.active && m.team === t.code);
    if (!ms.length) return;
    items.push(<ListSubheader key={`h-${t.code}`} sx={{ lineHeight: '30px', color: t.color, fontWeight: 700 }}>{t.short}</ListSubheader>);
    ms.forEach((m) => items.push(
      <MenuItem key={m.id} onClick={() => onPick(m.id)} dense>
        <ListItemIcon><MemberAvatar m={m} size={24} /></ListItemIcon>
        <Box sx={{ flex: 1 }}>{m.name} <Typography component="span" variant="caption" color="text.secondary">{m.role}</Typography></Box>
        {selected?.includes(m.id) && <Icon name="CheckCircle" fontSize="small" color="success" />}
      </MenuItem>,
    ));
  });
  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose} PaperProps={{ sx: { maxHeight: 420, minWidth: 260 } }}>
      {items.length ? items : <MenuItem disabled>Add people on the Team tab first</MenuItem>}
    </Menu>
  );
}

export function DuePopover({ anchor, onClose, value, today, onPick }: { anchor: HTMLElement | null; onClose: () => void; value: string; today: string; onPick: (d: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} TransitionProps={{ onEnter: () => setV(value) }}>
      <Stack spacing={1} sx={{ p: 1.5 }}>
        <TextField type="date" size="small" value={v} onChange={(e) => setV(e.target.value)} />
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {([['Today', 0], ['Tomorrow', 1], ['+1 week', 7]] as const).map(([n, d]) => (
            <Button key={n} size="small" variant="outlined" onClick={() => { onClose(); onPick(addDays(today, d)); }}>{n}</Button>
          ))}
          <Button size="small" color="inherit" onClick={() => { onClose(); onPick(''); }}>Clear</Button>
        </Stack>
        <Divider />
        <Button size="small" variant="contained" onClick={() => { onClose(); onPick(v); }}>Set</Button>
      </Stack>
    </Popover>
  );
}

/** Small round "tick" button. */
export function Tick({ on, onClick, disabled, size = 22 }: { on: boolean; onClick?: (e: MouseEvent) => void; disabled?: boolean; size?: number }) {
  return (
    <ButtonBase
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }} disabled={disabled}
      sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, border: '2px solid', transition: 'all .15s',
        borderColor: on ? 'success.main' : 'divider', bgcolor: on ? 'success.main' : 'transparent', color: on ? '#fff' : 'transparent',
        '&:hover': { borderColor: 'success.main', color: on ? '#fff' : 'success.main' },
      }}
    >
      <Icon name="Check" sx={{ fontSize: size * 0.7 }} />
    </ButtonBase>
  );
}

export const statusColor = (s: string) => taskStatusMeta(s).color;
