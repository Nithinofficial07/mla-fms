/**
 * DEMO data only. Every row here is flagged `isDemo: true` in the database and
 * is meant to be deleted/replaced once the real constituency data is imported.
 * The real 22 department names, wards, GPs, villages etc. are supplied later
 * and loaded via the Admin bulk-import - no code change required.
 */

export const DEMO_DEPARTMENTS = Array.from({ length: 22 }, (_, i) => {
  const n = i + 1;
  return {
    code: `DEP${String(n).padStart(2, '0')}`,
    name: `Line Department ${String(n).padStart(2, '0')} (DEMO)`,
    description: 'Placeholder department. Replace with the real department name.',
    officerDesignation: 'Officer',
  };
});

export const DEMO_WARDS = Array.from({ length: 6 }, (_, i) => ({
  name: `Ward ${String(i + 1).padStart(2, '0')}`,
  number: String(i + 1),
  code: `W-${String(i + 1).padStart(2, '0')}`,
}));

export const DEMO_GPS = Array.from({ length: 4 }, (_, i) => ({
  name: `Gram Panchayat ${String(i + 1).padStart(2, '0')}`,
  code: `GP-${String(i + 1).padStart(3, '0')}`,
}));

/** village name -> parent GP index */
export const DEMO_VILLAGES = [
  { name: 'Village 01', code: 'V-001', gpIndex: 0, subs: ['Sub Village A', 'Sub Village B'] },
  { name: 'Village 02', code: 'V-002', gpIndex: 0, subs: ['Sub Village A'] },
  { name: 'Village 03', code: 'V-003', gpIndex: 1, subs: ['Sub Village A', 'Sub Village B'] },
  { name: 'Village 04', code: 'V-004', gpIndex: 2, subs: [] },
];

/** ward name -> urban localities (villages with parentType WARD) */
export const DEMO_WARD_AREAS = [
  { name: 'Area A', code: 'A-01', wardIndex: 0 },
  { name: 'Area B', code: 'A-02', wardIndex: 0 },
  { name: 'Area C', code: 'A-03', wardIndex: 1 },
];

export const DEMO_USERS = [
  { key: 'mla', name: 'MLA (DEMO)', username: 'mla', email: 'mla@mla.local', roleCode: 'MLA', password: 'Mla@12345' },
  { key: 'officer', name: 'Department Officer (DEMO)', username: 'officer', email: 'officer@mla.local', roleCode: 'DEPARTMENT_OFFICER', password: 'Officer@12345' },
  { key: 'operator', name: 'Data Entry Operator (DEMO)', username: 'operator', email: 'operator@mla.local', roleCode: 'DATA_ENTRY_OPERATOR', password: 'Operator@123' },
  { key: 'viewer', name: 'Viewer (DEMO)', username: 'viewer', email: 'viewer@mla.local', roleCode: 'VIEWER', password: 'Viewer@12345' },
];
