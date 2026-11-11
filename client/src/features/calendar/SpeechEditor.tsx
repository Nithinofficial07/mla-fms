import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Box, Button, Dialog, Divider, IconButton, Menu, MenuItem, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import { Icon } from '@/components/Icon';

/* ------------------------------- sanitising ------------------------------- */
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'FONT', 'SPAN', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'MARK', 'H1', 'H2', 'H3']);
const ALLOWED_STYLE = new Set(['color', 'background-color', 'font-size', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line']);

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Keeps only simple formatting (bold/italic/underline/strike, colour, highlight,
 * size, lists, alignment). Scripts, links, images, event handlers and anything
 * else are dropped. Old plain-text speeches are turned into line-broken HTML.
 */
export function sanitizeSpeechHtml(input: string | undefined | null): string {
  const raw = input ?? '';
  if (!raw.trim()) return '';
  if (!/<[a-z!/]/i.test(raw)) return escapeHtml(raw).replace(/\n/g, '<br>');
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as HTMLElement;
    const frag = document.createDocumentFragment();
    const kids = () => el.childNodes.forEach((c) => { const k = clean(c); if (k) frag.appendChild(k); });
    if (!ALLOWED_TAGS.has(el.tagName)) {
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'].includes(el.tagName)) return null;
      kids();
      return frag;
    }
    const out = document.createElement(el.tagName.toLowerCase());
    const style = el.getAttribute('style');
    if (style) {
      const kept = style.split(';').map((d) => d.trim()).filter((d) => {
        const [prop, ...rest] = d.split(':');
        const val = rest.join(':').toLowerCase();
        return ALLOWED_STYLE.has((prop ?? '').trim().toLowerCase()) && !/url\(|expression|javascript:/.test(val);
      });
      if (kept.length) out.setAttribute('style', kept.join('; '));
    }
    if (el.tagName === 'FONT') {
      const color = el.getAttribute('color');
      const size = el.getAttribute('size');
      if (color && /^#?[\w]+$/.test(color)) out.setAttribute('color', color);
      if (size && /^[1-7]$/.test(size)) out.setAttribute('size', size);
    }
    const align = el.getAttribute('align');
    if (align && /^(left|right|center|justify)$/.test(align)) out.setAttribute('align', align);
    el.childNodes.forEach((c) => { const k = clean(c); if (k) out.appendChild(k); });
    return out;
  };
  const wrap = document.createElement('div');
  doc.body.firstChild?.childNodes.forEach((c) => { const k = clean(c); if (k) wrap.appendChild(k); });
  return wrap.innerHTML;
}

export function speechText(html: string | undefined | null) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeSpeechHtml(html);
  div.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  div.querySelectorAll('p,div,li').forEach((b) => b.append('\n'));
  return (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
export function speechStats(html: string | undefined | null) {
  const words = speechText(html).split(/\s+/).filter(Boolean).length;
  // ~110 words a minute for a speech delivered from the stage.
  return { words, minutes: words ? Math.max(1, Math.round(words / 110)) : 0 };
}

/* --------------------------------- editor --------------------------------- */
const COLOURS = ['#000000', '#C62828', '#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00838F', '#757575'];
const HIGHLIGHTS = ['#FFF59D', '#C8E6C9', '#BBDEFB', '#F8BBD0', '#FFE0B2', 'transparent'];
const SIZES = [{ v: '2', label: 'Small' }, { v: '3', label: 'Normal' }, { v: '5', label: 'Large' }, { v: '6', label: 'Huge' }];

function Tool({ title, icon, onClick, children }: { title: string; icon?: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; children?: ReactNode }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={onClick} aria-label={title}>
        {icon ? <Icon name={icon} fontSize="small" /> : children}
      </IconButton>
    </Tooltip>
  );
}

function RichEditor({ value, onChange, placeholder, lang }: { value: string; onChange: (html: string) => void; placeholder: string; lang: 'kn' | 'en' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [colourAnchor, setColourAnchor] = useState<{ el: HTMLElement; kind: 'fore' | 'hilite' } | null>(null);
  const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);

  // Only push the value in when it changed from outside - keeps the caret where it is while typing.
  useEffect(() => {
    const el = ref.current;
    if (el && sanitizeSpeechHtml(el.innerHTML) !== sanitizeSpeechHtml(value)) el.innerHTML = sanitizeSpeechHtml(value);
  }, [value]);

  const emit = () => { if (ref.current) onChange(sanitizeSpeechHtml(ref.current.innerHTML)); };
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    try { document.execCommand('styleWithCSS', false, cmd === 'hiliteColor' || cmd === 'foreColor' ? 'true' : 'false'); } catch { /* old browsers */ }
    document.execCommand(cmd, false, arg);
    emit();
  };

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', '&:focus-within': { borderColor: 'primary.main' } }}>
      <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ px: 0.5, py: 0.25, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
        <Tool title="Undo" icon="Undo" onClick={() => exec('undo')} />
        <Tool title="Redo" icon="Redo" onClick={() => exec('redo')} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tool title="Text size" icon="TextIncrease" onClick={(e) => setSizeAnchor(e.currentTarget)} />
        <Tool title="Bold" icon="FormatBold" onClick={() => exec('bold')} />
        <Tool title="Italic" icon="FormatItalic" onClick={() => exec('italic')} />
        <Tool title="Underline" icon="FormatUnderlined" onClick={() => exec('underline')} />
        <Tool title="Strikethrough" icon="FormatStrikethrough" onClick={() => exec('strikeThrough')} />
        <Tool title="Text colour" icon="FormatColorText" onClick={(e) => setColourAnchor({ el: e.currentTarget, kind: 'fore' })} />
        <Tool title="Highlight" icon="FormatColorFill" onClick={(e) => setColourAnchor({ el: e.currentTarget, kind: 'hilite' })} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tool title="Bulleted list" icon="FormatListBulleted" onClick={() => exec('insertUnorderedList')} />
        <Tool title="Numbered list" icon="FormatListNumbered" onClick={() => exec('insertOrderedList')} />
        <Tool title="Align left" icon="FormatAlignLeft" onClick={() => exec('justifyLeft')} />
        <Tool title="Centre" icon="FormatAlignCenter" onClick={() => exec('justifyCenter')} />
        <Tool title="Align right" icon="FormatAlignRight" onClick={() => exec('justifyRight')} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tool title="Clear formatting" icon="FormatClear" onClick={() => exec('removeFormat')} />
      </Stack>
      <Box
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        lang={lang}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          // Paste as clean HTML (Word / WhatsApp formatting is mostly noise).
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertHTML', false, html ? sanitizeSpeechHtml(html) : escapeHtml(text).replace(/\n/g, '<br>'));
          emit();
        }}
        sx={{
          minHeight: 180, maxHeight: 420, overflowY: 'auto', p: 1.5, outline: 'none', fontSize: 16, lineHeight: 1.7,
          fontFamily: lang === 'kn' ? '"Noto Sans Kannada", "Tunga", sans-serif' : 'inherit',
          '&:empty::before': { content: 'attr(data-placeholder)', color: 'text.disabled' },
          '& ul, & ol': { pl: 3, my: 0.5 },
        }}
      />
      <Menu anchorEl={sizeAnchor} open={!!sizeAnchor} onClose={() => setSizeAnchor(null)}>
        {SIZES.map((s) => <MenuItem key={s.v} onMouseDown={(e) => e.preventDefault()} onClick={() => { setSizeAnchor(null); exec('fontSize', s.v); }}>{s.label}</MenuItem>)}
      </Menu>
      <Menu anchorEl={colourAnchor?.el} open={!!colourAnchor} onClose={() => setColourAnchor(null)}>
        <Stack direction="row" spacing={0.75} sx={{ px: 1.5, py: 0.5 }}>
          {(colourAnchor?.kind === 'hilite' ? HIGHLIGHTS : COLOURS).map((c) => (
            <Box
              key={c} component="button" type="button" title={c === 'transparent' ? 'None' : c}
              onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
              onClick={() => { const k = colourAnchor!.kind; setColourAnchor(null); exec(k === 'hilite' ? 'hiliteColor' : 'foreColor', c); }}
              sx={{ width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', bgcolor: c, border: 1, borderColor: 'divider', backgroundImage: c === 'transparent' ? 'linear-gradient(135deg, transparent 45%, #D32F2F 45% 55%, transparent 55%)' : 'none' }}
            />
          ))}
        </Stack>
      </Menu>
    </Box>
  );
}

/** Kannada / English speech, each a small rich-text editor, with word count and speaking time. */
export function SpeechEditor({ kn, en, onChange }: { kn: string; en: string; onChange: (v: { kn: string; en: string }) => void }) {
  const [lang, setLang] = useState<'kn' | 'en'>(kn || !en ? 'kn' : 'en');
  const stats = speechStats(lang === 'kn' ? kn : en);
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Tabs value={lang} onChange={(_e, v) => setLang(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}>
          <Tab value="kn" label={`ಕನ್ನಡ${kn ? ' •' : ''}`} />
          <Tab value="en" label={`English${en ? ' •' : ''}`} />
        </Tabs>
        <Typography variant="caption" color="text.secondary">{stats.words} words · ~{stats.minutes} min to speak</Typography>
      </Stack>
      <Box sx={{ mt: 1 }}>
        {lang === 'kn'
          ? <RichEditor key="kn" lang="kn" value={kn} onChange={(v) => onChange({ kn: v, en })} placeholder="ಭಾಷಣವನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ…" />
          : <RichEditor key="en" lang="en" value={en} onChange={(v) => onChange({ kn, en: v })} placeholder="Write the speech here…" />}
      </Box>
    </Box>
  );
}

/* --------------------------------- viewer --------------------------------- */
/** Read-only speech with a full-screen reader (bigger text for reading from the stage). */
export function SpeechViewer({ kn, en, title }: { kn?: string; en?: string; title: string }) {
  const [lang, setLang] = useState<'kn' | 'en'>(kn ? 'kn' : 'en');
  const [full, setFull] = useState(false);
  const [size, setSize] = useState(26);
  const html = sanitizeSpeechHtml(lang === 'kn' ? kn : en);
  const stats = speechStats(lang === 'kn' ? kn : en);
  if (!kn && !en) return <Typography variant="body2" color="text.secondary">Speech not written yet.</Typography>;
  const body = (fs: number) => (
    <Box
      lang={lang} dangerouslySetInnerHTML={{ __html: html }}
      sx={{ fontSize: fs, lineHeight: 1.7, wordBreak: 'break-word', fontFamily: lang === 'kn' ? '"Noto Sans Kannada", "Tunga", sans-serif' : 'inherit', '& ul, & ol': { pl: 3 } }}
    />
  );
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        {kn && en && (
          <Tabs value={lang} onChange={(_e, v) => setLang(v)} sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0 } }}>
            <Tab value="kn" label="ಕನ್ನಡ" /><Tab value="en" label="English" />
          </Tabs>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{stats.words} words · ~{stats.minutes} min</Typography>
        <Button size="small" startIcon={<Icon name="Fullscreen" />} onClick={() => setFull(true)}>Read</Button>
      </Stack>
      <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', maxHeight: 260, overflowY: 'auto' }}>{body(15)}</Box>
      <Dialog open={full} onClose={() => setFull(false)} fullScreen>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ flex: 1 }}>{title}</Typography>
          <Tooltip title="Smaller"><IconButton onClick={() => setSize((s) => Math.max(16, s - 2))}><Icon name="TextDecrease" /></IconButton></Tooltip>
          <Typography variant="caption" sx={{ width: 32, textAlign: 'center' }}>{size}</Typography>
          <Tooltip title="Bigger"><IconButton onClick={() => setSize((s) => Math.min(60, s + 2))}><Icon name="TextIncrease" /></IconButton></Tooltip>
          {kn && en && <Button onClick={() => setLang(lang === 'kn' ? 'en' : 'kn')}>{lang === 'kn' ? 'English' : 'ಕನ್ನಡ'}</Button>}
          <IconButton onClick={() => setFull(false)} aria-label="Close"><Icon name="FullscreenExit" /></IconButton>
        </Stack>
        <Box sx={{ p: { xs: 2, sm: 5 }, maxWidth: 1000, mx: 'auto', width: '100%', overflowY: 'auto' }}>{body(size)}</Box>
      </Dialog>
    </Box>
  );
}
