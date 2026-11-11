/**
 * ದಿನದ ಚಿಂತನೆ - the line printed at the top of the daily poster.
 * The office keeps its own list (Calendar > poster > Manage quotes); this is
 * the starter set it is seeded with. Authors are given only for lines that
 * are well known to be theirs; everything else is left unattributed rather
 * than guessed.
 */

export const QUOTE_KINDS = [
  { code: 'CHINTANE', label: 'ಚಿಂತನೆ', en: 'Thought' },
  { code: 'SUBHASHITA', label: 'ಸುಭಾಷಿತ', en: 'Subhashita' },
  { code: 'GAADE', label: 'ಗಾದೆ', en: 'Proverb' },
] as const;
export type QuoteKind = (typeof QUOTE_KINDS)[number]['code'];
export const QUOTE_KIND_CODES = QUOTE_KINDS.map((k) => k.code) as [QuoteKind, ...QuoteKind[]];

export interface QuoteSeed {
  text: string;
  author?: string;
  kind: QuoteKind;
  /** "MM-DD": used on that date every year instead of the rotation. */
  monthDay?: string;
}

export const DEFAULT_QUOTES: QuoteSeed[] = [
  // --- special days ---
  { kind: 'CHINTANE', monthDay: '11-01', text: 'ಎಲ್ಲಾದರು ಇರು, ಎಂತಾದರು ಇರು, ಎಂದೆಂದಿಗೂ ನೀ ಕನ್ನಡವಾಗಿರು.', author: 'ಕುವೆಂಪು' },
  { kind: 'CHINTANE', monthDay: '12-29', text: 'ಮನುಜ ಮತ, ವಿಶ್ವ ಪಥ.', author: 'ಕುವೆಂಪು' },
  { kind: 'CHINTANE', monthDay: '08-15', text: 'ಸ್ವಾತಂತ್ರ್ಯ ಎಂಬುದು ನಮಗೆ ಸಿಕ್ಕ ಹಕ್ಕು ಮಾತ್ರವಲ್ಲ; ಅದನ್ನು ರಕ್ಷಿಸಿ, ದೇಶದ ಪ್ರಗತಿಗೆ ಶ್ರಮಿಸುವುದು ನಮ್ಮ ಪ್ರತಿಯೊಬ್ಬರ ಕರ್ತವ್ಯ.' },
  { kind: 'CHINTANE', monthDay: '01-26', text: 'ಸಂವಿಧಾನವೇ ನಮ್ಮ ಪ್ರಜಾಪ್ರಭುತ್ವದ ಬೆನ್ನೆಲುಬು; ಅದನ್ನು ಗೌರವಿಸುವುದು ಪ್ರತಿಯೊಬ್ಬ ನಾಗರಿಕನ ಕರ್ತವ್ಯ.' },
  { kind: 'CHINTANE', monthDay: '01-12', text: 'ಏಳಿ, ಎದ್ದೇಳಿ, ಗುರಿ ಮುಟ್ಟುವವರೆಗೂ ನಿಲ್ಲದಿರಿ.', author: 'ಸ್ವಾಮಿ ವಿವೇಕಾನಂದ' },
  { kind: 'CHINTANE', monthDay: '04-14', text: 'ಶಿಕ್ಷಣ, ಸಂಘಟನೆ, ಹೋರಾಟ - ಇವೇ ಸಮಾನತೆಯ ದಾರಿ.', author: 'ಡಾ. ಬಿ.ಆರ್. ಅಂಬೇಡ್ಕರ್' },
  { kind: 'CHINTANE', monthDay: '10-02', text: 'ಸತ್ಯ ಮತ್ತು ಅಹಿಂಸೆ - ಗಾಂಧೀಜಿಯವರ ಬದುಕಿನ ಎರಡು ದೀಪಗಳು.' },
  { kind: 'SUBHASHITA', monthDay: '09-05', text: 'ಗುರುರ್ಬ್ರಹ್ಮಾ ಗುರುರ್ವಿಷ್ಣುಃ ಗುರುರ್ದೇವೋ ಮಹೇಶ್ವರಃ - ಗುರುವೇ ದೇವರಿಗೆ ಸಮಾನ.' },
  { kind: 'CHINTANE', monthDay: '11-14', text: 'ಇಂದಿನ ಮಕ್ಕಳೇ ನಾಳಿನ ಭಾರತದ ಭವಿಷ್ಯ.' },
  { kind: 'CHINTANE', monthDay: '06-05', text: 'ಪರಿಸರ ಉಳಿಸಿದರೆ ಮಾತ್ರ ನಾಳಿನ ಪೀಳಿಗೆ ಉಳಿಯುತ್ತದೆ.' },
  { kind: 'CHINTANE', monthDay: '06-21', text: 'ಯೋಗ ದೇಹಕ್ಕೆ ಆರೋಗ್ಯ, ಮನಸ್ಸಿಗೆ ಶಾಂತಿ.' },

  // --- vachanas / well-known lines ---
  { kind: 'CHINTANE', text: 'ಕಾಯಕವೇ ಕೈಲಾಸ.', author: 'ಬಸವಣ್ಣ' },
  { kind: 'CHINTANE', text: 'ದಯವೇ ಧರ್ಮದ ಮೂಲವಯ್ಯಾ.', author: 'ಬಸವಣ್ಣ' },
  { kind: 'CHINTANE', text: 'ನುಡಿದರೆ ಮುತ್ತಿನ ಹಾರದಂತಿರಬೇಕು.', author: 'ಬಸವಣ್ಣ' },
  { kind: 'CHINTANE', text: 'ಕಳಬೇಡ, ಕೊಲಬೇಡ, ಹುಸಿಯ ನುಡಿಯಲು ಬೇಡ.', author: 'ಬಸವಣ್ಣ' },
  { kind: 'CHINTANE', text: 'ಇವನಾರವ ಇವನಾರವ ಎಂದೆನಿಸದಿರಯ್ಯಾ, ಇವ ನಮ್ಮವ ಇವ ನಮ್ಮವ ಎಂದೆನಿಸಯ್ಯಾ.', author: 'ಬಸವಣ್ಣ' },
  { kind: 'CHINTANE', text: 'ಬದುಕು ಜಟಕಾ ಬಂಡಿ, ವಿಧಿ ಅದರ ಸಾಹೇಬ.', author: 'ಡಿ.ವಿ.ಜಿ.' },
  { kind: 'CHINTANE', text: 'ಉನ್ನತಿಯ ದಾರಿಯಲ್ಲಿ ಸಭ್ಯತೆಯ ಅಗತ್ಯ ಹೆಚ್ಚು ಇರುತ್ತದೆ.', author: 'ಸಿ. ವಿ. ರಾಮನ್' },
  { kind: 'CHINTANE', text: 'ಪ್ರಪಂಚದಲ್ಲಿ ಮರಣವಿಲ್ಲದ ವರ ಪಡೆದಿರುವ ವಸ್ತು "ಪುಸ್ತಕ".', author: 'ಗಯಟೆ' },

  // --- thoughts (unattributed) ---
  { kind: 'CHINTANE', text: 'ಧೈರ್ಯವೇ ಯಶಸ್ಸಿನ ಮೊದಲ ಹೆಜ್ಜೆ.' },
  { kind: 'CHINTANE', text: 'ವಿದ್ಯೆಯೇ ಕಣ್ಣು, ಜ್ಞಾನವೇ ಬೆಳಕು.' },
  { kind: 'CHINTANE', text: 'ಕನ್ನಡದ ನೆಲ, ಕನ್ನಡದ ಜಲ, ಕನ್ನಡದ ಭಾಷೆ ನಮ್ಮೆಲ್ಲರ ಹೆಮ್ಮೆಯ ಸಂಕೇತ.' },
  { kind: 'CHINTANE', text: 'ಸೇವೆಯೇ ನಿಜವಾದ ನಾಯಕತ್ವ.' },
  { kind: 'CHINTANE', text: 'ಒಗ್ಗಟ್ಟಿನಲ್ಲಿ ಬಲವಿದೆ.' },
  { kind: 'CHINTANE', text: 'ಶಿಸ್ತು ಯಶಸ್ಸಿನ ಅಡಿಪಾಯ.' },
  { kind: 'CHINTANE', text: 'ಸಮಯಪಾಲನೆಯೇ ಸಾಧನೆಯ ಮೊದಲ ಹೆಜ್ಜೆ.' },
  { kind: 'CHINTANE', text: 'ಪ್ರಾಮಾಣಿಕತೆಯೇ ಶ್ರೇಷ್ಠ ನೀತಿ.' },
  { kind: 'CHINTANE', text: 'ಜನರ ನಂಬಿಕೆಯೇ ನಮ್ಮ ದೊಡ್ಡ ಆಸ್ತಿ.' },
  { kind: 'CHINTANE', text: 'ಸ್ವಚ್ಛತೆಯೇ ಆರೋಗ್ಯದ ಮೂಲ.' },
  { kind: 'CHINTANE', text: 'ಓದು ಮನಸ್ಸನ್ನು ಬೆಳಗಿಸುತ್ತದೆ.' },
  { kind: 'CHINTANE', text: 'ಸಣ್ಣ ಸಹಾಯವೂ ದೊಡ್ಡ ಬದಲಾವಣೆ ತರಬಲ್ಲದು.' },
  { kind: 'CHINTANE', text: 'ಕಠಿಣ ಪರಿಶ್ರಮಕ್ಕೆ ಪರ್ಯಾಯವಿಲ್ಲ.' },
  { kind: 'CHINTANE', text: 'ವಿನಯವೇ ವಿದ್ಯೆಯ ಭೂಷಣ.' },
  { kind: 'CHINTANE', text: 'ಮಾತಿಗಿಂತ ಕೆಲಸವೇ ಹೆಚ್ಚು ಮಾತನಾಡುತ್ತದೆ.' },
  { kind: 'CHINTANE', text: 'ನೀರು ಉಳಿಸಿ, ಜೀವ ಉಳಿಸಿ.' },
  { kind: 'CHINTANE', text: 'ಮಹಿಳೆಯರ ಸಬಲೀಕರಣವೇ ಸಮಾಜದ ಪ್ರಗತಿ.' },
  { kind: 'CHINTANE', text: 'ರೈತನೇ ದೇಶದ ಬೆನ್ನೆಲುಬು.' },
  { kind: 'CHINTANE', text: 'ಯುವಶಕ್ತಿಯೇ ದೇಶದ ಶಕ್ತಿ.' },
  { kind: 'CHINTANE', text: 'ಗಿಡ ನೆಡುವುದು ನಾಳಿನ ಪೀಳಿಗೆಗೆ ನೀಡುವ ಉಡುಗೊರೆ.' },
  { kind: 'CHINTANE', text: 'ಸಹನೆಯೇ ಸಾಮರಸ್ಯದ ಸೇತುವೆ.' },
  { kind: 'CHINTANE', text: 'ಪ್ರತಿ ದಿನವೂ ಹೊಸ ಆರಂಭಕ್ಕೆ ಒಂದು ಅವಕಾಶ.' },
  { kind: 'CHINTANE', text: 'ಕಲಿಕೆಗೆ ವಯಸ್ಸಿನ ಮಿತಿ ಇಲ್ಲ.' },
  { kind: 'CHINTANE', text: 'ಸ್ನೇಹ ಮತ್ತು ಸೌಹಾರ್ದ ಊರಿನ ನಿಜವಾದ ಸಂಪತ್ತು.' },
  { kind: 'CHINTANE', text: 'ಆತ್ಮವಿಶ್ವಾಸವೇ ಗೆಲುವಿನ ಕೀಲಿ.' },

  // --- subhashitas (with meaning) ---
  { kind: 'SUBHASHITA', text: 'ವಿದ್ಯಾ ದದಾತಿ ವಿನಯಂ - ವಿದ್ಯೆಯು ವಿನಯವನ್ನು ನೀಡುತ್ತದೆ.' },
  { kind: 'SUBHASHITA', text: 'ಸತ್ಯಮೇವ ಜಯತೇ - ಸತ್ಯಕ್ಕೆ ಮಾತ್ರ ಜಯ.' },
  { kind: 'SUBHASHITA', text: 'ವಸುಧೈವ ಕುಟುಂಬಕಮ್ - ಇಡೀ ಜಗತ್ತೇ ಒಂದು ಕುಟುಂಬ.' },
  { kind: 'SUBHASHITA', text: 'ಅಹಿಂಸಾ ಪರಮೋ ಧರ್ಮಃ - ಅಹಿಂಸೆಯೇ ಶ್ರೇಷ್ಠ ಧರ್ಮ.' },
  { kind: 'SUBHASHITA', text: 'ಜನನೀ ಜನ್ಮಭೂಮಿಶ್ಚ ಸ್ವರ್ಗಾದಪಿ ಗರೀಯಸೀ - ತಾಯಿ ಮತ್ತು ತಾಯ್ನಾಡು ಸ್ವರ್ಗಕ್ಕಿಂತಲೂ ಮಿಗಿಲು.' },
  { kind: 'SUBHASHITA', text: 'ಉದ್ಯಮೇನ ಹಿ ಸಿಧ್ಯಂತಿ ಕಾರ್ಯಾಣಿ ನ ಮನೋರಥೈಃ - ಕೆಲಸಗಳು ಪ್ರಯತ್ನದಿಂದ ಸಿದ್ಧಿಸುತ್ತವೆ, ಬರೀ ಆಸೆಯಿಂದಲ್ಲ.' },
  { kind: 'SUBHASHITA', text: 'ಸರ್ವೇ ಭವಂತು ಸುಖಿನಃ - ಎಲ್ಲರೂ ಸುಖವಾಗಿರಲಿ.' },
  { kind: 'SUBHASHITA', text: 'ಧರ್ಮೋ ರಕ್ಷತಿ ರಕ್ಷಿತಃ - ಧರ್ಮವನ್ನು ರಕ್ಷಿಸಿದವರನ್ನು ಧರ್ಮ ರಕ್ಷಿಸುತ್ತದೆ.' },
  { kind: 'SUBHASHITA', text: 'ಆಚಾರಃ ಪರಮೋ ಧರ್ಮಃ - ಉತ್ತಮ ನಡತೆಯೇ ಶ್ರೇಷ್ಠ ಧರ್ಮ.' },
  { kind: 'SUBHASHITA', text: 'ಪರೋಪಕಾರಾರ್ಥಮಿದಂ ಶರೀರಮ್ - ಈ ದೇಹ ಇತರರ ಉಪಕಾರಕ್ಕಾಗಿ.' },

  // --- proverbs ---
  { kind: 'GAADE', text: 'ಆರೋಗ್ಯವೇ ಭಾಗ್ಯ.' },
  { kind: 'GAADE', text: 'ಮನಸ್ಸಿದ್ದರೆ ಮಾರ್ಗ.' },
  { kind: 'GAADE', text: 'ಹನಿ ಹನಿ ಕೂಡಿದರೆ ಹಳ್ಳ, ತೆನೆ ತೆನೆ ಕೂಡಿದರೆ ಬಳ್ಳ.' },
  { kind: 'GAADE', text: 'ಕೈ ಕೆಸರಾದರೆ ಬಾಯಿ ಮೊಸರು.' },
  { kind: 'GAADE', text: 'ಬೆಳೆಯುವ ಸಿರಿ ಮೊಳಕೆಯಲ್ಲಿ.' },
  { kind: 'GAADE', text: 'ತಾಳಿದವನು ಬಾಳಿಯಾನು.' },
  { kind: 'GAADE', text: 'ದೇಶ ಸುತ್ತು, ಕೋಶ ಓದು.' },
  { kind: 'GAADE', text: 'ಕೂಡಿ ಬಾಳಿದರೆ ಸ್ವರ್ಗ ಸುಖ.' },
  { kind: 'GAADE', text: 'ಹಾಸಿಗೆ ಇದ್ದಷ್ಟು ಕಾಲು ಚಾಚು.' },
  { kind: 'GAADE', text: 'ಅತಿ ಆಸೆ ಗತಿ ಕೇಡು.' },
  { kind: 'GAADE', text: 'ಮಾತೇ ಮುತ್ತು, ಮಾತೇ ಮೃತ್ಯು.' },
  { kind: 'GAADE', text: 'ಆಳಾಗಬಲ್ಲವನು ಅರಸಾಗಬಲ್ಲ.' },
  { kind: 'GAADE', text: 'ಮಾಡಿದ್ದುಣ್ಣೋ ಮಹರಾಯ.' },
  { kind: 'GAADE', text: 'ಹಿತ್ತಲ ಗಿಡ ಮದ್ದಲ್ಲ.' },
];

export interface QuoteLike { id?: string; text: string; author?: string; kind: string; monthDay?: string | null; active?: boolean }

/**
 * The quote for a date: a special-day line if one is set for that MM-DD, else
 * the next line in a fixed rotation (by days since 2000-01-01), so consecutive
 * days never repeat until the list runs out. `offset` steps to the next ones
 * ("give me another").
 */
export function pickQuote<T extends QuoteLike>(list: T[], isoDate: string, kind: QuoteKind | 'ANY' = 'ANY', offset = 0): T | null {
  const usable = list.filter((q) => q.active !== false && (kind === 'ANY' || q.kind === kind));
  if (!usable.length) return null;
  const monthDay = isoDate.slice(5, 10);
  const special = usable.filter((q) => q.monthDay === monthDay);
  const rotation = usable.filter((q) => !q.monthDay);
  const day = Math.floor((Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) - Date.UTC(2000, 0, 1)) / 86_400_000);
  if (special.length && offset === 0) return special[0];
  const pool = rotation.length ? rotation : usable;
  const step = special.length ? offset - 1 : offset;
  return pool[(((day + step) % pool.length) + pool.length) % pool.length];
}
