export interface TimelineEntry {
  action: string;
  label: string;
  toStatus: string | null;
  at: string;
}

export interface TrackResult {
  fileId: string;
  requestId: string;
  subject: string;
  statusCode: string;
  statusName: string;
  department: string | null;
  submittedAt: string;
  dueDate: string | null;
  updatedAt: string;
  timeline: TimelineEntry[];
}
