import { useTheme, alpha } from '@mui/material/styles';

interface Props {
  size?: number;
}

/**
 * Small hand-coded flat-vector illustrations (unDraw-style, built from plain
 * shapes rather than traced art) in the app's Navy+Gold palette. Colors are
 * read from the active theme so they hold up in both light and dark mode.
 */

/** An open, empty folder being looked over with a magnifying glass - "no records here". */
export function EmptyBoxIllustration({ size = 180 }: Props) {
  const { palette } = useTheme();
  const navy = palette.primary.main;
  const gold = palette.secondary.main;
  const tint = alpha(navy, palette.mode === 'dark' ? 0.28 : 0.1);
  const line = alpha(navy, palette.mode === 'dark' ? 0.45 : 0.25);

  return (
    <svg width={size} height={size} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="140" rx="70" ry="8" fill={tint} />
      <path d="M35 55 L75 45 L165 55 L165 115 Q165 122 158 122 L42 122 Q35 122 35 115 Z" fill={tint} stroke={navy} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M35 55 L45 40 Q48 35 55 35 L95 35 Q101 35 104 40 L110 50" fill="none" stroke={navy} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="58" y1="75" x2="118" y2="75" stroke={line} strokeWidth="3" strokeLinecap="round" />
      <line x1="58" y1="88" x2="102" y2="88" stroke={line} strokeWidth="3" strokeLinecap="round" />
      <circle cx="141" cy="82" r="17" fill={palette.background.paper} stroke={gold} strokeWidth="4" />
      <line x1="153" y1="94" x2="167" y2="108" stroke={gold} strokeWidth="5" strokeLinecap="round" />
      <circle cx="30" cy="30" r="3" fill={gold} opacity="0.7" />
      <circle cx="175" cy="35" r="2.5" fill={gold} opacity="0.5" />
      <circle cx="170" cy="130" r="2" fill={gold} opacity="0.6" />
    </svg>
  );
}

/** A compass whose needle has wandered - "this page doesn't exist / took a wrong turn". */
export function NotFoundIllustration({ size = 180 }: Props) {
  const { palette } = useTheme();
  const navy = palette.primary.main;
  const gold = palette.secondary.main;
  const tint = alpha(navy, palette.mode === 'dark' ? 0.28 : 0.08);

  return (
    <svg width={size} height={size} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="140" rx="65" ry="8" fill={tint} />
      <path d="M40 95 Q60 40 110 35 Q150 32 165 55" fill="none" stroke={alpha(navy, 0.35)} strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
      <circle cx="95" cy="90" r="52" fill={palette.background.paper} stroke={navy} strokeWidth="3" />
      <circle cx="95" cy="90" r="52" fill="none" stroke={alpha(navy, 0.25)} strokeWidth="1" strokeDasharray="2 5" />
      <path d="M95 90 L118 62 L104 96 Z" fill={gold} />
      <path d="M95 90 L72 118 L86 84 Z" fill={navy} />
      <circle cx="95" cy="90" r="5" fill={palette.background.paper} stroke={navy} strokeWidth="2.5" />
      <text x="95" y="55" textAnchor="middle" fontSize="10" fontWeight={700} fill={navy}>N</text>
      <text x="95" y="132" textAnchor="middle" fontSize="10" fontWeight={700} fill={navy}>S</text>
      <circle cx="150" cy="130" r="3" fill={gold} opacity="0.6" />
      <circle cx="30" cy="60" r="2.5" fill={gold} opacity="0.5" />
    </svg>
  );
}

/** A padlock with a soft glow - "this area needs permission". */
export function LockedIllustration({ size = 180 }: Props) {
  const { palette } = useTheme();
  const navy = palette.primary.main;
  const gold = palette.secondary.main;
  const tint = alpha(navy, palette.mode === 'dark' ? 0.28 : 0.08);
  const glow = alpha(gold, palette.mode === 'dark' ? 0.22 : 0.14);

  return (
    <svg width={size} height={size} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="140" rx="65" ry="8" fill={tint} />
      <circle cx="100" cy="80" r="58" fill={glow} />
      <path d="M75 68 L75 52 Q75 30 100 30 Q125 30 125 52 L125 68" fill="none" stroke={navy} strokeWidth="6" strokeLinecap="round" />
      <rect x="62" y="66" width="76" height="62" rx="10" fill={palette.background.paper} stroke={navy} strokeWidth="3" />
      <circle cx="100" cy="92" r="9" fill={gold} />
      <rect x="96" y="98" width="8" height="16" rx="3" fill={gold} />
    </svg>
  );
}

/** A civic building with a flag and a document - the auth-screen brand illustration. */
export function CivicIllustration({ size = 320 }: Props) {
  const { palette } = useTheme();
  const line = alpha('#ffffff', 0.85);
  const soft = alpha('#ffffff', 0.5);
  const faint = alpha('#ffffff', 0.22);
  const gold = palette.mode === 'dark' ? '#D4A017' : '#F5C542';

  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 320 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="224" rx="130" ry="12" fill={faint} />
      {/* flagpole */}
      <line x1="252" y1="40" x2="252" y2="190" stroke={soft} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M252 40 L288 50 L252 60 Z" fill={gold} />
      {/* building */}
      <path d="M90 100 L160 62 L230 100 Z" fill={faint} stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="90" y="100" width="140" height="90" fill={faint} stroke={line} strokeWidth="2.5" />
      <rect x="104" y="118" width="16" height="72" fill={soft} />
      <rect x="132" y="118" width="16" height="72" fill={soft} />
      <rect x="172" y="118" width="16" height="72" fill={soft} />
      <rect x="200" y="118" width="16" height="72" fill={soft} />
      <rect x="140" y="150" width="40" height="40" rx="2" fill={palette.mode === 'dark' ? '#101B2C' : '#0B3450'} stroke={gold} strokeWidth="2" />
      <rect x="82" y="190" width="156" height="10" rx="2" fill={line} />
      {/* document card floating in front */}
      <rect x="30" y="140" width="66" height="82" rx="8" fill={palette.background.paper} stroke={gold} strokeWidth="2.5" />
      <line x1="42" y1="160" x2="84" y2="160" stroke={alpha('#0B3450', 0.5)} strokeWidth="3" strokeLinecap="round" />
      <line x1="42" y1="172" x2="84" y2="172" stroke={alpha('#0B3450', 0.35)} strokeWidth="3" strokeLinecap="round" />
      <line x1="42" y1="184" x2="70" y2="184" stroke={alpha('#0B3450', 0.35)} strokeWidth="3" strokeLinecap="round" />
      <circle cx="63" cy="204" r="9" fill={gold} />
      <path d="M58 204 L62 208 L69 200" stroke="#0B3450" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* sparkles */}
      <circle cx="270" cy="150" r="2.5" fill={gold} opacity="0.8" />
      <circle cx="46" cy="110" r="2" fill={gold} opacity="0.7" />
      <circle cx="20" cy="70" r="2.5" fill={gold} opacity="0.6" />
    </svg>
  );
}
