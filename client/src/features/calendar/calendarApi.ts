import { api } from '@/api/client';
import type { CalendarItem } from './calendarUtils';

/** Thin, typed wrappers for the calendar module's REST surface - keeps components free of raw axios calls. */

export function fetchEvents(params: Record<string, string | undefined>) {
  return api.get('/calendar/events', { params }).then((r) => r.data as CalendarItem[]);
}

export function fetchEvent(id: string) {
  return api.get(`/calendar/events/${id}`).then((r) => r.data as CalendarItem);
}

export function createEvent(body: Record<string, unknown>) {
  return api.post('/calendar/events', body).then((r) => r.data as CalendarItem);
}

export function createQuickEvent(body: Record<string, unknown>) {
  return api.post('/calendar/events/quick', body).then((r) => r.data as CalendarItem);
}

export function updateEvent(id: string, body: Record<string, unknown>) {
  return api.patch(`/calendar/events/${id}`, body).then((r) => r.data as CalendarItem);
}

export function moveEvent(id: string, start: string, end: string) {
  return api.patch(`/calendar/events/${id}/move`, { start, end }).then((r) => r.data as CalendarItem);
}

export function deleteEvent(id: string) {
  return api.delete(`/calendar/events/${id}`);
}

export function setRsvp(id: string, code: string, status: string) {
  return api.post(`/calendar/events/${id}/rsvp`, { code, status }).then((r) => r.data as CalendarItem);
}

export function setAttendance(id: string, body: { code: string; status: string; members?: string[]; note?: string }) {
  return api.post(`/calendar/events/${id}/attendance`, body).then((r) => r.data as CalendarItem);
}

export function setPrep(id: string, body: { prep?: string[]; prepDone?: string[]; prepNote?: string }) {
  return api.patch(`/calendar/events/${id}/prep`, body).then((r) => r.data as CalendarItem);
}

export function setReply(id: string, reply: string) {
  return api.patch(`/calendar/events/${id}/reply`, { reply }).then((r) => r.data as CalendarItem);
}

export function setSocial(id: string, body: { code: string; status: string; platforms?: string[]; caption?: string }) {
  return api.post(`/calendar/events/${id}/social`, body).then((r) => r.data as CalendarItem);
}

export interface Clash { memberCode: string; reason: 'GOING' | 'AWAY'; event: { id: string; title: string; start: string; end: string } }
export function checkClashes(body: { members: string[]; start: string; end: string; excludeId?: string }) {
  return api.post('/calendar/clashes', body).then((r) => r.data as Clash[]);
}

export function markAway(body: { members: string[]; start: string; end: string; reason?: string }) {
  return api.post('/calendar/away', body).then((r) => r.data as CalendarItem);
}

export interface WorkLists {
  toDecide: CalendarItem[]; toCheck: CalendarItem[]; toFill: CalendarItem[];
  toPost: CalendarItem[]; organisersNotReplied: CalendarItem[]; comingUp: CalendarItem[];
}
export function fetchWorkLists() {
  return api.get('/calendar/worklists').then((r) => r.data as WorkLists);
}

export function fetchMonthlySummary(month: string) {
  return api.get('/calendar/reports/summary', { params: { month } }).then((r) => r.data);
}

export interface ChangeLogEntry { id: string; eventId: string; title: string; action: string; detail: string[]; byName: string; at: string }
export function fetchChangeLog(params: { from?: string; to?: string; eventId?: string; limit?: number }) {
  return api.get('/calendar/reports/changes', { params }).then((r) => r.data as ChangeLogEntry[]);
}

export function fetchWhatsappText(params: Record<string, string | undefined>) {
  return api.get('/calendar/export', { params: { ...params, format: 'whatsapp' } }).then((r) => r.data as string);
}

export function importBackup(events: Record<string, unknown>[]) {
  return api.post('/calendar/import', { events }).then((r) => r.data as { created: number; updated: number; skipped: number; errors: string[] });
}

export function fetchPhoto(code: string) {
  return api.get(`/calendar/photos/${code}`).then((r) => r.data as { url: string | null; updatedAt?: string });
}

export function uploadPhoto(code: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.put(`/calendar/photos/${code}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
}

export interface CalendarReferenceData {
  calendars: { code: string; label: string; title: string; short: string; badge: string; color: string }[];
  eventCategories: { code: string; label: string }[];
  eventTypes: { code: string; label: string }[];
  rsvpStatuses: { code: string; label: string }[];
  organiserKinds: { code: string; label: string }[];
  awayPresets: { code: string; label: string }[];
  roleAtEvent: { code: string; label: string }[];
  preparationItems: { code: string; label: string }[];
  organiserReplyStatuses: { code: string; label: string }[];
  socialPlatforms: string[];
  eventStatuses: { code: string; label: string }[];
  repeatOptions: { code: string; label: string }[];
  attendanceStatuses: { code: string; label: string }[];
  holidaySources: unknown;
  holidays: Record<string, { date: string; name: string }[]>;
  worldDaysEveryYear: { date: string; name: string }[];
  kannadaLabels: Record<string, string>;
}
export function fetchReferenceData() {
  return api.get('/calendar/reference').then((r) => r.data as CalendarReferenceData);
}

export function documentsForEvent(eventId: string) {
  return api.get(`/documents/calendar/${eventId}`).then((r) => r.data);
}

export function uploadEventDocument(eventId: string, file: File, documentType: string) {
  const form = new FormData();
  form.append('files', file);
  form.append('documentType', documentType);
  return api.post(`/documents/calendar/${eventId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
}
