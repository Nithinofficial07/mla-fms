/**
 * Daily programme poster: draws the day's events onto one of the office's
 * poster designs (public/poster-templates, the designer's 7 posters with the
 * old event text, quote and date line removed). Everything is drawn on a
 * 1122 x 1402 canvas - the designs' own size - so the download matches the
 * originals pixel for pixel.
 */
import type { Dayjs } from 'dayjs';

export const POSTER_W = 1122;
export const POSTER_H = 1402;

export interface PosterTemplate {
  id: number;
  /** Top of the quote text (just under the "ದಿನದ ಚಿಂತನೆ:" heading) and how far down it may go. */
  quoteTop: number;
  quoteBottom: number;
  /** Event list: first and last usable y. */
  top: number;
  bottom: number;
  /** Right edge of the text by height - the leader's photo starts lower down on the right. [untilY, rightX] */
  rightEdge: [number, number][];
  /** The red date bar. */
  barY: number;
  barH: number;
}

export const POSTER_TEMPLATES: PosterTemplate[] = [
  { id: 1, quoteTop: 56, quoteBottom: 150, top: 170, bottom: 1045, rightEdge: [[500, 790], [9999, 700]], barY: 1297, barH: 57 },
  { id: 2, quoteTop: 56, quoteBottom: 150, top: 170, bottom: 1045, rightEdge: [[430, 960], [9999, 740]], barY: 1297, barH: 57 },
  { id: 3, quoteTop: 56, quoteBottom: 150, top: 165, bottom: 1050, rightEdge: [[540, 840], [9999, 790]], barY: 1297, barH: 57 },
  { id: 4, quoteTop: 56, quoteBottom: 150, top: 192, bottom: 1045, rightEdge: [[470, 850], [9999, 700]], barY: 1297, barH: 57 },
  { id: 5, quoteTop: 56, quoteBottom: 150, top: 188, bottom: 1045, rightEdge: [[9999, 745]], barY: 1297, barH: 57 },
  { id: 6, quoteTop: 84, quoteBottom: 158, top: 208, bottom: 1095, rightEdge: [[580, 860], [9999, 720]], barY: 1346, barH: 56 },
  { id: 7, quoteTop: 56, quoteBottom: 150, top: 170, bottom: 1045, rightEdge: [[460, 840], [9999, 730]], barY: 1297, barH: 57 },
];

export const templateUrl = (id: number) => `/poster-templates/poster-${id}.jpg`;
export const templateThumbUrl = (id: number) => `/poster-templates/poster-${id}-thumb.jpg`;

export interface PosterLine {
  time: string;
  title: string;
  venue: string;
}

export interface PosterData {
  date: Dayjs;
  quote: string;
  author: string;
  lines: PosterLine[];
}

/* ------------------------------ Kannada words ------------------------------ */
const WEEKDAYS_KN = ['ಭಾನುವಾರ', 'ಸೋಮವಾರ', 'ಮಂಗಳವಾರ', 'ಬುಧವಾರ', 'ಗುರುವಾರ', 'ಶುಕ್ರವಾರ', 'ಶನಿವಾರ'];

/** "ಬೆಳಿಗ್ಗೆ : 10:30 AM" - morning before 12, afternoon to 4 PM, evening to 7 PM, then night (as on the office's posters). */
export function kannadaTimeLabel(t: Dayjs, allDay = false): string {
  if (allDay) return 'ದಿನವಿಡೀ';
  const h = t.hour();
  const part = h < 12 ? 'ಬೆಳಿಗ್ಗೆ' : h < 16 ? 'ಮಧ್ಯಾಹ್ನ' : h < 19 ? 'ಸಂಜೆ' : 'ರಾತ್ರಿ';
  return `${part} : ${t.format('hh:mm A')}`;
}

/** "11-11-2026 ನೇ ಬುಧವಾರದ ಕಾರ್ಯಕ್ರಮಗಳ ವಿವರ" */
export const kannadaDateLine = (d: Dayjs) => `${d.format('DD-MM-YYYY')} ನೇ ${WEEKDAYS_KN[d.day()]}ದ ಕಾರ್ಯಕ್ರಮಗಳ ವಿವರ`;

/* ---------------------------------- fonts ---------------------------------- */
const HEAVY = '"Baloo Tamma 2", "Noto Sans Kannada", sans-serif';
const BODY = '"Noto Sans Kannada", "Baloo Tamma 2", sans-serif';

/** Canvas only uses a web font once it has loaded - wait for every weight the poster draws with. */
export async function loadPosterFonts() {
  await Promise.all([
    document.fonts.load(`800 28px ${HEAVY}`, 'ಕಾರ್ಯಕ್ರಮ AM'),
    document.fonts.load(`700 28px ${HEAVY}`, 'ಕಾರ್ಯಕ್ರಮ AM'),
    document.fonts.load(`500 24px ${BODY}`, 'ದಾವಣಗೆರೆ'),
    document.fonts.load(`600 26px ${BODY}`, 'ದಾವಣಗೆರೆ'),
  ]);
}

const imageCache = new Map<number, Promise<HTMLImageElement>>();
export function loadTemplate(id: number): Promise<HTMLImageElement> {
  let p = imageCache.get(id);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { imageCache.delete(id); reject(new Error(`Poster design ${id} could not be loaded`)); };
      img.src = templateUrl(id);
    });
    imageCache.set(id, p);
  }
  return p;
}

/* --------------------------------- drawing --------------------------------- */
const RED = '#C62828';
const NAVY = '#1F2690';
const VENUE = '#262626';
const DOTS = '#2B3A9C';

/** Greedy word wrap. A single word wider than the line is left to overflow rather than broken mid-syllable. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.lineWidth = Math.max(1.6, r * 0.2);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx, cy); ctx.lineTo(cx + r * 0.45, cy + r * 0.3); ctx.stroke();
  ctx.restore();
}

function drawPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.35, r, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(cx, cy + r * 1.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.35, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDots(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = DOTS;
  for (let x = x0; x < x1; x += size * 2) ctx.fillRect(x, y, size, size);
  ctx.restore();
}

const rightAt = (t: PosterTemplate, y: number) => (t.rightEdge.find(([until]) => y < until) ?? t.rightEdge[t.rightEdge.length - 1])[1];

const TEXT_X = 56;
const ICON_X = 30;

/** Lays the event list out at a given scale; draws only when `draw` is true. Returns the y it ended at. */
function layoutEvents(ctx: CanvasRenderingContext2D, t: PosterTemplate, lines: PosterLine[], s: number, draw: boolean): number {
  const timeSize = 28 * s;
  const titleSize = 28 * s;
  const venueSize = 24 * s;
  const lh = 1.32;
  let y = t.top;
  lines.forEach((ln) => {
    // time
    y += 6 * s;
    ctx.font = `700 ${timeSize}px ${HEAVY}`;
    const timeBase = y + timeSize;
    if (draw) {
      drawClock(ctx, ICON_X, timeBase - timeSize * 0.36, 9.5 * s);
      ctx.fillStyle = RED;
      ctx.fillText(ln.time, TEXT_X, timeBase);
    }
    y += timeSize * lh;
    // title
    ctx.font = `800 ${titleSize}px ${HEAVY}`;
    for (const l of wrap(ctx, ln.title, rightAt(t, y) - TEXT_X)) {
      if (draw) { ctx.fillStyle = NAVY; ctx.fillText(l, TEXT_X, y + titleSize); }
      y += titleSize * lh;
    }
    // venue
    if (ln.venue.trim()) {
      ctx.font = `500 ${venueSize}px ${BODY}`;
      wrap(ctx, ln.venue, rightAt(t, y) - TEXT_X).forEach((l, i) => {
        if (draw) {
          if (i === 0) drawPin(ctx, ICON_X, y + venueSize * 0.6, 8.5 * s);
          ctx.fillStyle = VENUE;
          ctx.fillText(l, TEXT_X, y + venueSize);
        }
        y += venueSize * lh;
      });
    }
    // dotted separator
    y += 4 * s;
    if (draw) drawDots(ctx, ICON_X + 10, rightAt(t, y) - 6, y, Math.max(2.5, 3.2 * s));
    y += 8 * s;
  });
  return y;
}

/** Largest scale (1 down to 0.5) at which every event fits above the name banner. */
function fitScale(ctx: CanvasRenderingContext2D, t: PosterTemplate, lines: PosterLine[]): { scale: number; fits: boolean } {
  for (let s = 1; s >= 0.5; s -= 0.025) {
    if (layoutEvents(ctx, t, lines, s, false) <= t.bottom) return { scale: s, fits: true };
  }
  return { scale: 0.5, fits: false };
}

function drawQuote(ctx: CanvasRenderingContext2D, t: PosterTemplate, quote: string, author: string) {
  const q = quote.trim();
  if (!q) return;
  const text = /^["“]/.test(q) ? q : `"${q}"`;
  const centre = 575;
  const width = 700;
  const room = t.quoteBottom - t.quoteTop - (author.trim() ? 26 : 0);
  let size = 27;
  let lines: string[] = [];
  for (; size >= 17; size -= 1) {
    ctx.font = `600 ${size}px ${BODY}`;
    lines = wrap(ctx, text, width);
    if (lines.length * size * 1.35 <= room) break;
  }
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, centre, t.quoteTop + size + i * size * 1.35));
  if (author.trim()) {
    ctx.font = `800 21px ${HEAVY}`;
    ctx.textAlign = 'right';
    ctx.fillText(`- ${author.trim().replace(/^-\s*/, '')}`, 900, t.quoteTop + lines.length * size * 1.35 + 24);
  }
  ctx.textAlign = 'left';
}

function drawDateBar(ctx: CanvasRenderingContext2D, t: PosterTemplate, date: Dayjs) {
  let size = 35;
  const text = kannadaDateLine(date);
  ctx.font = `700 ${size}px ${HEAVY}`;
  while (ctx.measureText(text).width > POSTER_W - 80 && size > 22) { size -= 1; ctx.font = `700 ${size}px ${HEAVY}`; }
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, POSTER_W / 2, t.barY + t.barH / 2 + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Draws the whole poster. Returns whether every event fitted (false = some text runs into the banner). */
export async function renderPoster(canvas: HTMLCanvasElement, templateId: number, data: PosterData): Promise<{ fits: boolean; scale: number }> {
  const t = POSTER_TEMPLATES.find((x) => x.id === templateId) ?? POSTER_TEMPLATES[0];
  const [img] = await Promise.all([loadTemplate(t.id), loadPosterFonts()]);
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  ctx.drawImage(img, 0, 0, POSTER_W, POSTER_H);
  drawQuote(ctx, t, data.quote, data.author);
  const lines = data.lines.filter((l) => l.title.trim() || l.time.trim());
  const fit = fitScale(ctx, t, lines);
  layoutEvents(ctx, t, lines, fit.scale, true);
  drawDateBar(ctx, t, data.date);
  return fit;
}

/** A different design each day of the week, until someone picks one. */
export const defaultTemplateFor = (d: Dayjs) => (d.diff(d.startOf('year'), 'day') % 7) + 1;
