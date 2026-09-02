/**
 * Configurable File / Request ID formatter.
 * Tokens:
 *   {YYYY}       full year            -> 2026
 *   {YY}         2-digit year         -> 26
 *   {MM}         2-digit month        -> 09
 *   {SEQ:n}      zero-padded sequence -> {SEQ:6} => 000123
 *   {PREFIX}     supplied prefix
 * Anything else is emitted literally, so "MLA/{YYYY}/{SEQ:6}" -> "MLA/2026/000123".
 */
export interface FormatIdOptions {
  format: string;
  seq: number;
  date?: Date;
  prefix?: string;
}

export function formatId({ format, seq, date = new Date(), prefix = '' }: FormatIdOptions): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return format.replace(/\{(\w+)(?::(\d+))?\}/g, (_m, token: string, pad?: string) => {
    switch (token) {
      case 'YYYY': return yyyy;
      case 'YY': return yyyy.slice(-2);
      case 'MM': return mm;
      case 'PREFIX': return prefix;
      case 'SEQ': return String(seq).padStart(pad ? Number(pad) : 1, '0');
      default: return _m;
    }
  });
}

export const DEFAULT_FILE_ID_FORMAT = 'MLA/{YYYY}/{SEQ:6}';
export const DEFAULT_REQUEST_ID_FORMAT = 'REQ/{YYYY}/{SEQ:6}';
export const DEFAULT_DOCUMENT_ID_FORMAT = 'DOC-{YYYY}-{SEQ:6}';
export const DEFAULT_LETTER_NO_FORMAT = 'MLA-LTR/{YYYY}/{SEQ:4}';

/** Fixed lifecycle for an MLA letter (kept simple - no configurable workflow). */
export const LETTER_STATUSES = ['DRAFT', 'ISSUED', 'DISPATCHED', 'REPLIED', 'CLOSED'] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];
