import ExcelJS from 'exceljs';
import {
  Constituency, GramPanchayat, SubVillage, Village, Ward,
} from '../../models/location.js';
import { Department } from '../../models/Department.js';

export interface RowError {
  row: number;
  field: string;
  message: string;
}
export interface ImportReport {
  totalRows: number;
  validRows: number;
  createdCount: number;
  errors: RowError[];
}

export const LOCATION_COLUMNS = [
  'area_type', 'ward_name', 'ward_code',
  'gram_panchayat_name', 'gram_panchayat_code',
  'village_name', 'village_code',
  'sub_village_name', 'sub_village_code',
] as const;

export const DEPARTMENT_COLUMNS = [
  'code', 'name', 'description', 'head_name', 'officer_name',
  'officer_designation', 'contact_number', 'email', 'office_address',
] as const;

async function readRows(buffer: Buffer, expected: readonly string[]): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const header: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    header[col] = String(cell.value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  });
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell((cell, col) => {
      const key = header[col];
      if (key && expected.includes(key)) obj[key] = String(cell.value ?? '').trim();
    });
    if (Object.values(obj).some(Boolean)) rows.push(obj);
  });
  return rows;
}

/** Validates (and optionally commits) a location hierarchy spreadsheet. */
export async function importLocations(
  buffer: Buffer,
  opts: { dryRun: boolean; createdBy: string },
): Promise<ImportReport> {
  const rows = await readRows(buffer, LOCATION_COLUMNS);
  const errors: RowError[] = [];
  const primary = await Constituency.findOne({ isPrimary: true }).lean();
  if (!primary) {
    return { totalRows: rows.length, validRows: 0, createdCount: 0, errors: [{ row: 0, field: 'constituency', message: 'Create the primary constituency first (Setup wizard).' }] };
  }

  let valid = 0;
  let created = 0;
  const seenCodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const line = i + 2;
    const areaType = (r.area_type || '').toUpperCase();
    if (!['URBAN', 'RURAL'].includes(areaType)) {
      errors.push({ row: line, field: 'area_type', message: 'Must be URBAN or RURAL' });
      continue;
    }
    if (areaType === 'URBAN' && !r.ward_name) {
      errors.push({ row: line, field: 'ward_name', message: 'Required for URBAN rows' });
      continue;
    }
    if (areaType === 'RURAL' && !r.gram_panchayat_name) {
      errors.push({ row: line, field: 'gram_panchayat_name', message: 'Required for RURAL rows' });
      continue;
    }
    if (r.village_name && areaType === 'RURAL' && !r.gram_panchayat_name) {
      errors.push({ row: line, field: 'village_name', message: 'Village needs a parent Gram Panchayat' });
      continue;
    }
    if (r.sub_village_name && !r.village_name) {
      errors.push({ row: line, field: 'sub_village_name', message: 'Sub-village needs a parent Village' });
      continue;
    }
    for (const codeField of ['ward_code', 'gram_panchayat_code', 'village_code', 'sub_village_code'] as const) {
      const code = r[codeField];
      if (code) {
        if (seenCodes.has(`${codeField}:${code}`)) {
          errors.push({ row: line, field: codeField, message: `Duplicate code "${code}" within file` });
        }
        seenCodes.add(`${codeField}:${code}`);
      }
    }
    valid++;

    if (opts.dryRun) continue;

    // Commit (idempotent upserts keyed by name within parent).
    let wardId: string | null = null;
    let gpId: string | null = null;
    if (areaType === 'URBAN') {
      const ward = await Ward.findOneAndUpdate(
        { name: r.ward_name, constituencyId: primary._id },
        { $setOnInsert: { name: r.ward_name, number: r.ward_code, code: r.ward_code, constituencyId: primary._id } },
        { new: true, upsert: true },
      );
      wardId = String(ward._id);
    } else {
      const gp = await GramPanchayat.findOneAndUpdate(
        { name: r.gram_panchayat_name, constituencyId: primary._id },
        { $setOnInsert: { name: r.gram_panchayat_name, code: r.gram_panchayat_code, constituencyId: primary._id } },
        { new: true, upsert: true },
      );
      gpId = String(gp._id);
    }
    if (r.village_name) {
      const village = await Village.findOneAndUpdate(
        { name: r.village_name, ...(gpId ? { gramPanchayatId: gpId } : { wardId }) },
        {
          $setOnInsert: {
            name: r.village_name,
            code: r.village_code,
            parentType: gpId ? 'GRAM_PANCHAYAT' : 'WARD',
            gramPanchayatId: gpId,
            wardId,
          },
        },
        { new: true, upsert: true },
      );
      created++;
      if (r.sub_village_name) {
        await SubVillage.findOneAndUpdate(
          { name: r.sub_village_name, villageId: village._id },
          { $setOnInsert: { name: r.sub_village_name, code: r.sub_village_code, villageId: village._id } },
          { new: true, upsert: true },
        );
        created++;
      }
    } else {
      created++;
    }
  }

  return { totalRows: rows.length, validRows: valid, createdCount: created, errors };
}

export async function importDepartments(
  buffer: Buffer,
  opts: { dryRun: boolean },
): Promise<ImportReport> {
  const rows = await readRows(buffer, DEPARTMENT_COLUMNS);
  const errors: RowError[] = [];
  let valid = 0;
  let created = 0;
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const line = i + 2;
    if (!r.code) errors.push({ row: line, field: 'code', message: 'Required' });
    if (!r.name) errors.push({ row: line, field: 'name', message: 'Required' });
    if (r.code && seen.has(r.code.toUpperCase())) errors.push({ row: line, field: 'code', message: 'Duplicate within file' });
    if (r.code) seen.add(r.code.toUpperCase());
    if (!r.code || !r.name) continue;
    valid++;
    if (opts.dryRun) continue;
    await Department.findOneAndUpdate(
      { code: r.code.toUpperCase() },
      {
        $setOnInsert: {
          code: r.code.toUpperCase(),
          name: r.name,
          description: r.description,
          headName: r.head_name,
          officerName: r.officer_name,
          officerDesignation: r.officer_designation,
          contactNumber: r.contact_number,
          email: r.email,
          officeAddress: r.office_address,
        },
      },
      { new: true, upsert: true },
    );
    created++;
  }
  return { totalRows: rows.length, validRows: valid, createdCount: created, errors };
}

/** Builds a downloadable xlsx template with a header row + one example row. */
export async function buildTemplate(kind: 'LOCATION' | 'DEPARTMENT'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kind === 'LOCATION' ? 'locations' : 'departments');
  const cols = kind === 'LOCATION' ? LOCATION_COLUMNS : DEPARTMENT_COLUMNS;
  ws.addRow([...cols]);
  ws.getRow(1).font = { bold: true };
  if (kind === 'LOCATION') {
    ws.addRow(['RURAL', '', '', 'Gram Panchayat 01', 'GP-001', 'Village 01', 'V-001', 'Sub Village A', 'SV-001']);
    ws.addRow(['URBAN', 'Ward 01', 'W-01', '', '', 'Area A', 'A-001', '', '']);
  } else {
    ws.addRow(['RD', 'Rural Development', 'Demo department', 'Head Name', 'Officer Name', 'Executive Officer', '9876543210', 'rd@example.gov.in', 'Block Office']);
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
