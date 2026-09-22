import { useMemo } from 'react';
import { Box } from '@mui/material';

const COLORS = ['#B8860B', '#0B3450', '#1B5E20', '#E65100', '#0277BD', '#D4A017'];

interface Piece {
  left: number;
  dx: number;
  dr: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  round: boolean;
}

/**
 * Lightweight CSS-only confetti burst - no canvas, no dependency.
 * Mount it (e.g. conditionally on success), it plays once and self-removes via `onDone`.
 */
export function Confetti({ count = 60, onDone }: { count?: number; onDone?: () => void }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        dx: Math.round((Math.random() - 0.5) * 240),
        dr: Math.round(180 + Math.random() * 540) * (Math.random() < 0.5 ? -1 : 1),
        delay: Math.random() * 0.25,
        duration: 1.4 + Math.random() * 1.1,
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.5,
      })),
    [count],
  );

  return (
    <Box
      aria-hidden
      onAnimationEnd={onDone}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (t) => t.zIndex.snackbar + 1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {pieces.map((p, i) => (
        <Box
          key={i}
          onAnimationEnd={i === 0 ? onDone : undefined}
          sx={{
            position: 'absolute',
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : 0.5,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
            '--dx': `${p.dx}px`,
            '--dr': `${p.dr}deg`,
          } as never}
        />
      ))}
    </Box>
  );
}
