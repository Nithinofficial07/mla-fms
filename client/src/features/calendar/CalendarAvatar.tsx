import { Avatar } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { CALENDAR_CODES } from '@mla/shared';
import { fetchPhoto } from './calendarApi';

/** A calendar's photo (falls back to its badge on the calendar colour). */
export function CalendarAvatar({ code, size = 28 }: { code: string; size?: number }) {
  const c = CALENDAR_CODES.find((x) => x.code === code);
  const { data } = useQuery({ queryKey: ['calendar', 'photo', code], queryFn: () => fetchPhoto(code), staleTime: 10 * 60_000 });
  return (
    <Avatar
      src={data?.url ?? undefined}
      alt={c?.title ?? code}
      sx={{ width: size, height: size, fontSize: size * 0.38, fontWeight: 800, bgcolor: c?.color, border: `2px solid ${c?.color ?? '#999'}` }}
    >
      {c?.badge ?? code.slice(0, 2)}
    </Avatar>
  );
}
