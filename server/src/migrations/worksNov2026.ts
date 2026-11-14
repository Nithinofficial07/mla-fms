/**
 * One-time load of the works sanctioned in two letters (Nov 2026), so they
 * appear in the Works menu without being typed in by hand:
 *
 *  A. Deputy Commissioner, Davanagere - Muzrai temple-development works,
 *     File No. DVDC-MUZ/59/2026-MUZARAYI-DAVANGERE DC E-1062087, 27.10.2026
 *     (on the District In-charge Minister's notes of 06.05.2026 and
 *     27.08.2026). 13 works, Rs 74.02 lakh; works 1-11 by KRIDL, 12-13 by
 *     Nirmithi Kendra.
 *  B. The Hutti Gold Mines Company Ltd - CSR 2025-26, letter
 *     No. ಹ.ಚಿ.ಗ.ಸಿ.ಎಸ್.ಆರ್/2026-27/90 to KRIDL (26th CSR committee meeting,
 *     02.09.2026). 6 works, Rs 250 lakh, all by KRIDL, Davanagere division.
 *
 * Both came through the Mines & Geology / District In-charge Minister, so
 * they are filed under MLA North. The exact ward / village is left for the
 * office to pick when editing - the place is in the address for now.
 * Skips any work already entered with the same name.
 */
import { Department } from '../models/Department.js';
import { Principal } from '../models/Principal.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { Work } from '../models/Work.js';
import { worksService } from '../modules/works/works.service.js';

interface Row { name: string; place: string; lakhs: number; agency: 'KRIDL' | 'Nirmithi Kendra'; city?: boolean }

const MUZRAI: Row[] = [
  { name: 'ಒಬಜ್ಜಿಹಳ್ಳಿ ಗ್ರಾಮದ ಸೇವಾಲಾಲ್ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಒಬಜ್ಜಿಹಳ್ಳಿ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 10, agency: 'KRIDL' },
  { name: 'ಬೇತೂರು ಗ್ರಾಮದ ಕಲ್ಲೇಶ್ವರ ಬಸವೇಶ್ವರ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಬೇತೂರು, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 5, agency: 'KRIDL' },
  { name: 'ಅವರಗೊಳ್ಳ ಗ್ರಾಮದ ಬೇತೂರು ಓಣಿ ಚೌಡಮ್ಮ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಅವರಗೊಳ್ಳ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 5, agency: 'KRIDL' },
  { name: 'ಹಳೇ ಕಡ್ಲೆಬಾಳು ದುರುಗಮ್ಮ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಹಳೇ ಕಡ್ಲೆಬಾಳು, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 3, agency: 'KRIDL' },
  { name: 'ಕಡ್ಲೆಬಾಳು ಆಂಜನೇಯ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಕಡ್ಲೆಬಾಳು, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 5, agency: 'KRIDL' },
  { name: 'ಬದಿಯಾನಾಯ್ಕನ ತಾಂಡ ಸೇವಾಲಾಲ್ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಬದಿಯಾನಾಯ್ಕನ ತಾಂಡ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 2, agency: 'KRIDL' },
  { name: 'ಪುಟಗನಾಳ ಗ್ರಾಮದ ಎ.ಕೆ. ಕಾಲೋನಿ ದುರುಗಮ್ಮ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಪುಟಗನಾಳ (ಎ.ಕೆ. ಕಾಲೋನಿ), ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 3, agency: 'KRIDL' },
  { name: 'ಆರಸಾಪುರ ಗ್ರಾಮ ಗೌರಚಂದ್ರಮಾರಮ್ಮ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಆರಸಾಪುರ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 5, agency: 'KRIDL' },
  { name: 'ಕೈದಾಳ್ ಕ್ಯಾಂಪ್ ಆಂಜನೇಯ ದೇವಸ್ಥಾನದ ಅಭಿವೃದ್ಧಿ', place: 'ಕೈದಾಳ್ ಕ್ಯಾಂಪ್, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 3, agency: 'KRIDL' },
  { name: 'ನಿರ್ಥಡಿ ಗ್ರಾಮದ ಶ್ರೀ ಲಕ್ಷ್ಮೀ ರಂಗನಾಥಸ್ವಾಮಿ ದೇವಸ್ಥಾನದ ಅಭಿವೃದ್ಧಿ ಕಾಮಗಾರಿ', place: 'ನಿರ್ಥಡಿ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 7.02, agency: 'KRIDL' },
  { name: 'ನಾಗರಸನಹಳ್ಳಿ ಗ್ರಾಮದ ಶ್ರೀ ವೀರಭದ್ರೇಶ್ವರ ದೇವಸ್ಥಾನದ ಅಭಿವೃದ್ಧಿ', place: 'ನಾಗರಸನಹಳ್ಳಿ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 6, agency: 'KRIDL' },
  { name: 'ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು, ಮಾಳಗೊಂಡನಹಳ್ಳಿ ಗ್ರಾಮದ ಶ್ರೀ ಊರಾಂಬಿಕಾ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಮಾಳಗೊಂಡನಹಳ್ಳಿ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 10, agency: 'Nirmithi Kendra' },
  { name: 'ಜಗಳೂರು ತಾಲ್ಲೂಕು, ಹಾಲೇಕಲ್ಲು ಗ್ರಾಮದ ಶ್ರೀ ಬಸವೇಶ್ವರ ಸ್ವಾಮಿ ದೇವಸ್ಥಾನ ಅಭಿವೃದ್ಧಿ', place: 'ಹಾಲೇಕಲ್ಲು, ಜಗಳೂರು ತಾಲ್ಲೂಕು', lakhs: 10, agency: 'Nirmithi Kendra' },
];

const CSR: Row[] = [
  { name: 'ದಾವಣಗೆರೆ ನಗರದ ಬಿ.ಡಿ ಲೇಔಟ್‌ನ ಸರ್ಕಾರಿ ಉರ್ದು ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆಗೆ ಶೌಚಾಲಯ ನಿರ್ಮಾಣ ಕಾಮಗಾರಿ', place: 'ಬಿ.ಡಿ ಲೇಔಟ್, ದಾವಣಗೆರೆ ನಗರ', lakhs: 10, agency: 'KRIDL', city: true },
  { name: 'ದಾವಣಗೆರೆ ನಗರದ ಶೇಖರಪ್ಪ ನಗರದ ಸರ್ಕಾರಿ ಉರ್ದು ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆಗೆ ಶೌಚಾಲಯ ನಿರ್ಮಾಣ ಕಾಮಗಾರಿ', place: 'ಶೇಖರಪ್ಪ ನಗರ, ದಾವಣಗೆರೆ ನಗರ', lakhs: 10, agency: 'KRIDL', city: true },
  { name: 'ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು ಕಾಡಜ್ಜಿ ಗ್ರಾಮದ ಶಾಲಾ ಆವರಣದಲ್ಲಿ ರಂಗಮಂದಿರ ನಿರ್ಮಾಣ', place: 'ಕಾಡಜ್ಜಿ, ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು', lakhs: 15, agency: 'KRIDL' },
  { name: 'ದಾವಣಗೆರೆ ತಾಲ್ಲೂಕು ನಾಗಮ್ಮ ಕೇಶವಮೂರ್ತಿ ಬಡಾವಣೆ ಸರ್ಕಾರಿ ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆಗೆ ಶೌಚಾಲಯ ನಿರ್ಮಾಣ', place: 'ನಾಗಮ್ಮ ಕೇಶವಮೂರ್ತಿ ಬಡಾವಣೆ, ದಾವಣಗೆರೆ', lakhs: 15, agency: 'KRIDL', city: true },
  { name: 'ಹರಪ್ಪನಹಳ್ಳಿ ತಾಲ್ಲೂಕು ದೈವಿವನದ ತಿಮ್ಮಪ್ಪನ ಗುಡ್ಡದ ಮೇಲೆ ವಿವಿಧ ಅಭಿವೃದ್ಧಿ ಕಾಮಗಾರಿಗಳು', place: 'ತಿಮ್ಮಪ್ಪನ ಗುಡ್ಡ (ದೈವಿವನ), ಹರಪ್ಪನಹಳ್ಳಿ ತಾಲ್ಲೂಕು', lakhs: 100, agency: 'KRIDL' },
  { name: 'ಹರಪ್ಪನಹಳ್ಳಿ ತಾಲ್ಲೂಕು ದೈವಿವನದ ತಿಮ್ಮಪ್ಪನ ಗುಡ್ಡದ ಮುಂದುವರೆದ ರಸ್ತೆ, ಬೀದಿ ದೀಪ ಹಾಗೂ ವಿದ್ಯುತ್ ಸಂಪರ್ಕ ಅಭಿವೃದ್ಧಿ ಕಾಮಗಾರಿಗಳು', place: 'ತಿಮ್ಮಪ್ಪನ ಗುಡ್ಡ (ದೈವಿವನ), ಹರಪ್ಪನಹಳ್ಳಿ ತಾಲ್ಲೂಕು', lakhs: 100, agency: 'KRIDL' },
];

const MUZRAI_REF = 'DC Davanagere (Muzrai) File No. DVDC-MUZ/59/2026-MUZARAYI-DAVANGERE DC E-1062087 dated 27.10.2026 - temple development under Muzrai schemes, on the District In-charge Minister\'s notes dated 06.05.2026 and 27.08.2026. Estimate with photos (3 copies), site khata copy and a no-encroachment certificate to be submitted.';
const CSR_REF = 'Hutti Gold Mines Co. Ltd letter No. ಹ.ಚಿ.ಗ.ಸಿ.ಎಸ್.ಆರ್/2026-27/90 to MD, KRIDL - CSR 2025-26, approved in the 26th CSR committee meeting (02.09.2026); ref. Mines & Geology Minister\'s letter 28.08.2025. Estimate with technical sanction to be sent to Hutti Gold Mines, limited to the amount.';

/** Finds a department by code / name, creating it when the office has not added it yet. */
async function department(code: string, match: RegExp, name: string) {
  const found = await Department.findOne({ $or: [{ code }, { name: match }] }).lean();
  if (found) return found._id;
  const created = await Department.create({ code, name, description: 'Added with the works loaded from the Nov 2026 sanction letters' });
  return created._id;
}

export async function loadNov2026Works() {
  const principal = await Principal.findOne({ code: 'MLA_N' }).lean() ?? await Principal.findOne({ code: 'MLA_S' }).lean();
  if (!principal) return { skipped: 'no principal yet' };
  const adminRole = await Role.findOne({ code: 'SUPER_ADMIN' }).select('_id').lean();
  const actor = (adminRole && await User.findOne({ roleId: adminRole._id }).select('_id').lean()) ?? await User.findOne({}).select('_id').lean();
  if (!actor) return { skipped: 'no user yet' };

  const kridl = await department('KRIDL', /KRIDL|Rural Infrastructure/i, 'Karnataka Rural Infrastructure Development Limited (KRIDL)');
  const nirmithi = await department('NIRMITHI', /Nirmi(t|th)i/i, 'Nirmithi Kendra');

  const batches: { rows: Row[]; fundingSource: string; fundingYear: string; remarks: string }[] = [
    { rows: MUZRAI, fundingSource: 'Muzrai Department – temple development grant (District In-charge Minister)', fundingYear: '2026-27', remarks: MUZRAI_REF },
    { rows: CSR, fundingSource: 'Hutti Gold Mines Co. Ltd – CSR', fundingYear: '2025-26', remarks: CSR_REF },
  ];

  let created = 0;
  let skipped = 0;
  for (const b of batches) {
    for (const r of b.rows) {
      if (await Work.exists({ nameOfWork: r.name })) { skipped++; continue; }
      await worksService.create({
        actorId: String(actor._id),
        body: {
          principalId: principal._id,
          departmentId: r.agency === 'KRIDL' ? kridl : nirmithi,
          implementingAgency: r.agency,
          fundingSource: b.fundingSource,
          fundingYear: b.fundingYear,
          nameOfWork: r.name,
          // Ward / gram panchayat to be picked by the office when editing.
          location: { locationType: r.city ? 'CITY' : 'GP', wardId: null, gramPanchayatId: null, villageId: null },
          address: r.place,
          remarks: b.remarks,
          amountLakhs: r.lakhs,
        },
      });
      created++;
    }
  }
  return { created, skipped, totalLakhs: [...MUZRAI, ...CSR].reduce((a, r) => a + r.lakhs, 0) };
}
