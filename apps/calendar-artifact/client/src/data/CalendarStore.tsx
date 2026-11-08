import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCapability, type Db, type DbError, type DownloadsCap, type UserCap } from './claude';

/** One event as saved in the artifact database (collection `events`). */
export interface StoredEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  start: string; // ISO
  end: string;
  allDay: boolean;
  recurrence: string;
  recurrenceUntil: string | null;
  venue: string;
  area: string;
  organizer: string;
  contactName: string;
  contactPhone: string;
  attendees: string[];
  createdBy?: string | null;
  createdAt?: string;
  updatedBy?: string | null;
  updatedAt?: string;
}
export type EventInput = Omit<StoredEvent, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>;

/** 'connecting' -> 'ready' | 'slow' (no answer yet) | 'offline' (no database for this view) | 'error' */
export type StoreStatus = 'connecting' | 'ready' | 'slow' | 'offline' | 'error';

interface Store {
  status: StoreStatus;
  events: StoredEvent[];
  /** Whether this viewer may add/edit events. */
  canEdit: boolean;
  save: (id: string | null, input: EventInput) => Promise<string>;
  patch: (id: string, input: Partial<EventInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Display names for user ids (resolved lazily). */
  nameOf: (id?: string | null) => string;
  downloads: DownloadsCap | null;
}

const Ctx = createContext<Store | null>(null);
const COLLECTION = 'events';

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
function toEvent(id: string, d: Record<string, unknown>): StoredEvent | null {
  const start = str(d.start);
  const end = str(d.end, start);
  if (!start || Number.isNaN(Date.parse(start))) return null; // shared data is untrusted - skip junk
  return {
    id,
    title: str(d.title, '(untitled)'),
    description: str(d.description),
    type: str(d.type, 'MEETING_OFFICIAL'),
    status: str(d.status, 'SCHEDULED'),
    start,
    end: Number.isNaN(Date.parse(end)) ? start : end,
    allDay: d.allDay === true,
    recurrence: str(d.recurrence, 'NONE'),
    recurrenceUntil: typeof d.recurrenceUntil === 'string' ? d.recurrenceUntil : null,
    venue: str(d.venue),
    area: str(d.area),
    organizer: str(d.organizer),
    contactName: str(d.contactName),
    contactPhone: str(d.contactPhone),
    attendees: Array.isArray(d.attendees) ? d.attendees.filter((a): a is string => typeof a === 'string') : [],
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : null,
    createdAt: str(d.createdAt),
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : null,
    updatedAt: str(d.updatedAt),
  };
}

export function CalendarStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StoreStatus>('connecting');
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [downloads, setDownloads] = useState<DownloadsCap | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const dbRef = useRef<Db | null>(null);
  const userRef = useRef<UserCap | null>(null);
  const meRef = useRef<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    (async () => {
      const [db, user, dl] = await Promise.all([
        useCapability<Db>('db'), useCapability<UserCap>('user'), useCapability<DownloadsCap>('downloads'),
      ]);
      if (!alive) return;
      setDownloads(dl);
      userRef.current = user;
      if (user) {
        try { meRef.current = await user.id(); } catch { /* no id */ }
        try {
          const w = await user.can('data.write');
          if (w === false) setCanEdit(false); // null = not told: keep inputs, a refused write decides
        } catch { /* keep default */ }
      }
      if (!db) { setStatus('offline'); setCanEdit(false); return; }
      dbRef.current = db;
      timer = setTimeout(() => setStatus((s) => (s === 'connecting' ? 'slow' : s)), 10_000);
      unsub = db.collection(COLLECTION).onSnapshot(
        (snap) => {
          const list: StoredEvent[] = [];
          for (const d of snap.docs) {
            const body = d.data();
            if (!body) continue;
            const ev = toEvent(d.id, body);
            if (ev) list.push(ev);
          }
          setEvents(list);
          if (!snap.metadata.fromCache) {
            if (timer) clearTimeout(timer);
            setStatus('ready');
          }
        },
        (e: DbError) => {
          if (timer) clearTimeout(timer);
          setStatus(e.code === 'revoked' ? 'offline' : 'error');
        },
      );
    })();
    return () => { alive = false; if (timer) clearTimeout(timer); unsub?.(); };
  }, []);

  // Resolve display names of whoever added events (stored as ids only).
  useEffect(() => {
    const user = userRef.current;
    if (!user) return;
    const ids = [...new Set(events.flatMap((e) => [e.createdBy, e.updatedBy]).filter((x): x is string => !!x))];
    if (!ids.length) return;
    user.profiles(ids).then((ps) => {
      const next: Record<string, string> = {};
      for (const id of ids) next[id] = ps?.[id]?.name || '';
      setNames(next);
    }).catch(() => { /* names are a nicety */ });
  }, [events]);

  const guard = useCallback(async <T,>(fn: (db: Db) => Promise<T>): Promise<T> => {
    const db = dbRef.current;
    if (!db) throw new Error('The calendar database is not available here. Open the calendar on claude.ai while signed in.');
    try {
      return await fn(db);
    } catch (e) {
      const code = (e as DbError)?.code;
      if (code === 'invalid_argument') {
        setCanEdit(false);
        throw new Error('You have view-only access to this calendar. Ask the owner to make you a Contributor to add or change events.');
      }
      if (code === 'quota_exceeded') throw new Error('The calendar is full. Delete some old events and try again.');
      if (code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        return fn(db);
      }
      throw new Error((e as DbError)?.message || 'Could not save. Check your connection and try again.');
    }
  }, []);

  const value = useMemo<Store>(() => ({
    status,
    events,
    canEdit,
    downloads,
    nameOf: (id) => (id ? names[id] || 'Someone' : ''),
    save: (id, input) => guard(async (db) => {
      const now = new Date().toISOString();
      const me = meRef.current;
      const existing = id ? events.find((e) => e.id === id) : undefined;
      const ref = id ? db.collection(COLLECTION).doc(id) : db.collection(COLLECTION).doc();
      await ref.set({
        ...input,
        createdBy: existing?.createdBy ?? me ?? null,
        createdAt: existing?.createdAt || now,
        updatedBy: me ?? null,
        updatedAt: now,
      });
      return ref.id;
    }),
    patch: (id, input) => guard(async (db) => {
      await db.collection(COLLECTION).doc(id).update({ ...input, updatedBy: meRef.current ?? null, updatedAt: new Date().toISOString() });
    }),
    remove: (id) => guard(async (db) => { await db.collection(COLLECTION).doc(id).delete(); }),
  }), [status, events, canEdit, downloads, names, guard]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalendarStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useCalendarStore outside provider');
  return s;
}
