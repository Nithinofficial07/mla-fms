import { STATUS_COLORS } from '@/components/chips';

/**
 * The 5-step milestone model used by the request detail page's stepper and
 * the dashboard's "Stage N" cards - the one place status codes are grouped
 * into a broader lifecycle stage. Keep this the single source of truth so
 * both surfaces agree on what "Stage 2" means.
 */
export const MILESTONES = [
  { key: 'submitted', label: 'Registered', icon: 'NoteAdd', codes: ['DRAFT', 'SUBMITTED'] },
  { key: 'scrutiny', label: 'Office Scrutiny', icon: 'HourglassEmpty', codes: ['UNDER_REVIEW', 'AWAITING_INFO'] },
  { key: 'assigned', label: 'Dept Assigned', icon: 'AssignmentInd', codes: ['ASSIGNED'] },
  { key: 'action', label: 'Action in Progress', icon: 'Autorenew', codes: ['IN_PROGRESS', 'FORWARDED', 'DEPT_RESPONSE'] },
  { key: 'resolved', label: 'Resolved', icon: 'CheckCircle', codes: ['COMPLETED', 'APPROVED', 'CLOSED'] },
] as const;

/** One color per milestone, each matching that stage's dominant STATUS_COLORS entry. */
export const MILESTONE_COLORS: string[] = [
  STATUS_COLORS.SUBMITTED,
  STATUS_COLORS.UNDER_REVIEW,
  STATUS_COLORS.ASSIGNED,
  STATUS_COLORS.IN_PROGRESS,
  STATUS_COLORS.COMPLETED,
];

const CODE_TO_MILESTONE: Record<string, number> = {};
MILESTONES.forEach((m, i) => m.codes.forEach((c) => { CODE_TO_MILESTONE[c] = i; }));

/** REJECTED isn't part of the normal flow - it's tracked separately (see the dashboard's Rejected card). */
export function getMilestoneIndex(code: string): number {
  return CODE_TO_MILESTONE[code] ?? 0;
}
