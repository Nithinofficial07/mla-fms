import ExcelJS from 'exceljs';
import type { PipelineStage } from 'mongoose';
import PDFDocument from 'pdfkit';
import { RequestModel } from '../../models/Request.js';

export type ReportKey =
  | 'department' | 'ward' | 'gram-panchayat' | 'village'
  | 'status' | 'priority' | 'monthly' | 'officer'
  | 'pending' | 'overdue';

export interface ReportFilters {
  from?: string;
  to?: string;
  departmentId?: string;
  wardId?: string;
  gramPanchayatId?: string;
  villageId?: string;
  statusCode?: string;
  priorityId?: string;
}

function matchStage(f: ReportFilters): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (f.from || f.to) {
    m.createdAt = {};
    if (f.from) (m.createdAt as Record<string, unknown>).$gte = new Date(f.from);
    if (f.to) (m.createdAt as Record<string, unknown>).$lte = new Date(f.to);
  }
  if (f.departmentId) m.primaryDepartmentId = f.departmentId;
  if (f.wardId) m['location.wardId'] = f.wardId;
  if (f.gramPanchayatId) m['location.gramPanchayatId'] = f.gramPanchayatId;
  if (f.villageId) m['location.villageId'] = f.villageId;
  if (f.statusCode) m.statusCode = f.statusCode;
  if (f.priorityId) m.priorityId = f.priorityId;
  return m;
}

const PENDING_CODES = ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'FORWARDED', 'IN_PROGRESS', 'AWAITING_INFO', 'DEPT_RESPONSE'];

/** Groups requests by a lookup collection and reports total/pending/completed/overdue. */
async function groupBy(
  f: ReportFilters,
  groupField: string,
  lookup?: { from: string; label: string },
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const now = new Date();
  const pipeline: PipelineStage[] = [
    { $match: matchStage(f) },
    {
      $group: {
        _id: `$${groupField}`,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $in: ['$statusCode', PENDING_CODES] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $in: ['$statusCode', ['COMPLETED', 'APPROVED', 'CLOSED']] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', now] }, { $in: ['$statusCode', PENDING_CODES] }] }, 1, 0] } },
      },
    },
  ];
  if (lookup) {
    pipeline.push(
      { $lookup: { from: lookup.from, localField: '_id', foreignField: '_id', as: 'ref' } },
      { $unwind: { path: '$ref', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: [`$ref.${lookup.label}`, 'Unassigned / N/A'] }, total: 1, pending: 1, completed: 1, overdue: 1 } },
    );
  } else {
    pipeline.push({ $project: { name: { $ifNull: ['$_id', 'N/A'] }, total: 1, pending: 1, completed: 1, overdue: 1 } });
  }
  pipeline.push({ $sort: { total: -1 } });
  const rows = await RequestModel.aggregate(pipeline);
  return {
    columns: ['name', 'total', 'pending', 'completed', 'overdue'],
    rows: rows.map((r) => ({ name: r.name, total: r.total, pending: r.pending, completed: r.completed, overdue: r.overdue })),
  };
}

export async function buildReport(key: ReportKey, f: ReportFilters) {
  switch (key) {
    case 'department':
      return groupBy(f, 'primaryDepartmentId', { from: 'departments', label: 'name' });
    case 'ward':
      return groupBy(f, 'location.wardId', { from: 'wards', label: 'name' });
    case 'gram-panchayat':
      return groupBy(f, 'location.gramPanchayatId', { from: 'grampanchayats', label: 'name' });
    case 'village':
      return groupBy(f, 'location.villageId', { from: 'villages', label: 'name' });
    case 'status':
      return groupBy(f, 'statusCode');
    case 'priority':
      return groupBy(f, 'priorityId', { from: 'priorities', label: 'name' });
    case 'officer':
      return groupBy(f, 'assignedOfficerId', { from: 'users', label: 'name' });
    case 'monthly': {
      const rows = await RequestModel.aggregate([
        { $match: matchStage(f) },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]);
      return {
        columns: ['month', 'total'],
        rows: rows.map((r) => ({ month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, total: r.total })),
      };
    }
    case 'pending':
    case 'overdue': {
      const q: Record<string, unknown> = { ...matchStage(f), statusCode: { $in: PENDING_CODES } };
      if (key === 'overdue') q.dueDate = { $lt: new Date() };
      const rows = await RequestModel.find(q)
        .sort('dueDate')
        .limit(5000)
        .populate(['primaryDepartmentId', 'priorityId', 'statusId'])
        .lean();
      return {
        columns: ['fileId', 'subject', 'applicant', 'department', 'status', 'priority', 'dueDate'],
        rows: rows.map((r: any) => ({
          fileId: r.fileId,
          subject: r.subject,
          applicant: r.applicant?.name,
          department: r.primaryDepartmentId?.name ?? 'Unassigned',
          status: r.statusId?.name ?? r.statusCode,
          priority: r.priorityId?.name ?? '',
          dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : '',
        })),
      };
    }
    default:
      return { columns: [], rows: [] };
  }
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n');
}

export async function toXlsx(title: string, columns: string[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c, key: c, width: 24 }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPdf(title: string, columns: string[], rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'left' });
    doc.moveDown(0.5).fontSize(9).fillColor('#555').text(new Date().toLocaleString());
    doc.moveDown();
    doc.fillColor('#000').fontSize(9);
    doc.text(columns.join('  |  '));
    doc.moveTo(doc.x, doc.y).lineTo(760, doc.y).stroke();
    rows.slice(0, 2000).forEach((r) => {
      doc.text(columns.map((c) => String(r[c] ?? '')).join('  |  '));
    });
    doc.end();
  });
}
