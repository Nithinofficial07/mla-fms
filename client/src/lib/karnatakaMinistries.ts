/**
 * Government of Karnataka cabinet portfolios, current as of the Shivakumar
 * ministry's 18 August 2026 reshuffle (see Wikipedia: "Shivakumar ministry").
 * Used only to SUGGEST a department's ministryName - a human still reviews
 * and can edit/skip each suggestion before it's saved, since a wrong
 * minister's name on an official letter is worse than a blank field.
 *
 * Deliberately omits portfolios we couldn't confirm a current minister for
 * (e.g. Women & Child Development) rather than guessing.
 */
export interface Portfolio {
  minister: string;
  portfolio: string;
  keywords: string[];
}

export const KARNATAKA_PORTFOLIOS: Portfolio[] = [
  { minister: 'D. K. Shivakumar', portfolio: 'Finance', keywords: ['finance'] },
  { minister: 'D. K. Shivakumar', portfolio: 'Agriculture Marketing', keywords: ['agriculture marketing', 'apmc'] },
  { minister: 'D. K. Shivakumar', portfolio: 'Town & Country Planning', keywords: ['town planning', 'town and country planning'] },
  { minister: 'G. Parameshwara', portfolio: 'Revenue', keywords: ['revenue'] },
  { minister: 'G. Parameshwara', portfolio: 'Sports and Youth Empowerment', keywords: ['sports', 'youth empowerment', 'youth services'] },
  { minister: 'K. H. Muniyappa', portfolio: 'Social Welfare', keywords: ['social welfare'] },
  { minister: 'K. J. George', portfolio: 'Energy', keywords: ['energy', 'electricity', 'bescom', 'power supply'] },
  { minister: 'K. J. George', portfolio: 'Tourism', keywords: ['tourism'] },
  { minister: 'M. B. Patil', portfolio: 'Large & Medium Industries', keywords: ['large industries', 'medium industries', 'industries and commerce', 'commerce and industries', 'industries'] },
  { minister: 'M. B. Patil', portfolio: 'Infrastructure Development', keywords: ['infrastructure development', 'infrastructure'] },
  { minister: 'Satish Jarkiholi', portfolio: 'Public Works', keywords: ['public works', 'pwd'] },
  { minister: 'Krishna Byre Gowda', portfolio: 'Greater Bengaluru Development', keywords: ['bengaluru development', 'greater bengaluru'] },
  { minister: 'Krishna Byre Gowda', portfolio: 'Parliamentary Affairs and Legislation', keywords: ['parliamentary affairs', 'legislation'] },
  { minister: 'Priyank Kharge', portfolio: 'Home', keywords: ['home department', 'police'] },
  { minister: 'Priyank Kharge', portfolio: 'Information Technology & Biotechnology', keywords: ['information technology', 'biotechnology', 'it and bt', 'it & bt'] },
  { minister: 'Priyank Kharge', portfolio: 'E-Governance', keywords: ['e-governance', 'egovernance'] },
  { minister: 'U. T. Khader', portfolio: 'Health & Family Welfare', keywords: ['health', 'family welfare'] },
  { minister: 'U. T. Khader', portfolio: 'Minority Welfare', keywords: ['minority welfare'] },
  { minister: 'U. T. Khader', portfolio: 'Haj and Wakf', keywords: ['haj', 'wakf'] },
  { minister: 'Eshwara Khandre', portfolio: 'Rural Development', keywords: ['rural development'] },
  { minister: 'Eshwara Khandre', portfolio: 'Panchayati Raj', keywords: ['panchayat raj', 'panchayati raj', 'zilla panchayat', 'gram panchayat'] },
  { minister: 'Yathindra Siddaramaiah', portfolio: 'Urban Development', keywords: ['urban development'] },
  { minister: 'Byrathi Suresh', portfolio: 'Transport', keywords: ['transport', 'rto'] },
  { minister: 'Sharan Prakash Patil', portfolio: 'Medical Education', keywords: ['medical education'] },
  { minister: 'Sharan Prakash Patil', portfolio: 'Skill Development', keywords: ['skill development', 'employment and training'] },
  { minister: 'Ramalinga Reddy', portfolio: 'Forest, Ecology and Environment', keywords: ['forest', 'ecology', 'environment'] },
  { minister: 'B. Z. Zameer Ahmed Khan', portfolio: 'Housing', keywords: ['housing'] },
  { minister: 'Santosh Lad', portfolio: 'Labour', keywords: ['labour', 'labor'] },
  { minister: 'Rizwan Arshad', portfolio: 'Food and Civil Supplies', keywords: ['food and civil supplies', 'civil supplies', 'food supplies'] },
  { minister: 'Rizwan Arshad', portfolio: 'Consumer Affairs', keywords: ['consumer affairs'] },
  { minister: 'Madhu Bangarappa', portfolio: 'Primary and Secondary Education', keywords: ['primary education', 'secondary education', 'public instruction', 'school education'] },
  { minister: 'S. S. Mallikarjun', portfolio: 'Mines and Geology', keywords: ['mines and geology', 'mines'] },
  { minister: 'S. S. Mallikarjun', portfolio: 'Horticulture', keywords: ['horticulture'] },
  { minister: 'K. S. Basavanthappa', portfolio: 'Muzrai', keywords: ['muzrai', 'religious endowment'] },
  { minister: 'K. S. Basavanthappa', portfolio: 'Fisheries, Ports and Inland Water Transport', keywords: ['fisheries', 'ports', 'inland water'] },
  { minister: 'Laxman Savadi', portfolio: 'Co-operation', keywords: ['co-operation', 'cooperation'] },
  { minister: 'Vijayanand Kashappanavar', portfolio: 'Small Scale Industries', keywords: ['small scale industries', 'small industries', 'public enterprises'] },
  { minister: 'Basavaraj Rayareddy', portfolio: 'Higher Education', keywords: ['higher education', 'collegiate education'] },
  { minister: 'H. C. Balakrishna', portfolio: 'Municipal Administration', keywords: ['municipal administration'] },
  { minister: 'K. M. Shivalinge Gowda', portfolio: 'Excise', keywords: ['excise'] },
  { minister: 'N. Chaluvaraya Swamy', portfolio: 'Major and Medium Irrigation (Water Resources)', keywords: ['water resources', 'major irrigation', 'medium irrigation', 'irrigation'] },
  { minister: 'Ajay Singh', portfolio: 'Minor Irrigation', keywords: ['minor irrigation'] },
  { minister: 'Ajay Singh', portfolio: 'Science and Technology', keywords: ['science and technology'] },
  { minister: 'P. M. Narendraswamy', portfolio: 'Agriculture', keywords: ['agriculture'] },
  { minister: 'Shivaraj Tangadagi', portfolio: 'Backward Classes Welfare', keywords: ['backward classes'] },
  { minister: 'Shivaraj Tangadagi', portfolio: 'Kannada and Culture', keywords: ['kannada and culture', 'kannada culture'] },
  { minister: 'Rudrappa Lamani', portfolio: 'Sugar and Textiles', keywords: ['sugar', 'textiles'] },
  { minister: 'T. Raghumurthy', portfolio: 'Scheduled Tribe Welfare', keywords: ['scheduled tribe'] },
  { minister: 'C. Puttarangashetty', portfolio: 'Animal Husbandry and Sericulture', keywords: ['animal husbandry', 'sericulture', 'veterinary'] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(demo\)/g, '')
    .replace(/\bdept\.?\b/g, 'department')
    .replace(/\bdepartment of\b/g, '')
    .replace(/\bdepartment\b/g, '')
    .replace(/[^a-z0-9& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MinistrySuggestion {
  ministryName: string;
  minister: string;
  portfolio: string;
}

/**
 * Best-effort match of a department name to a Karnataka cabinet portfolio.
 * Two passes, so a short department name (e.g. "Agriculture") can't be
 * outscored by an unrelated but longer keyword that merely happens to
 * contain it (e.g. "Agriculture Marketing") - a real bug caught by this
 * function's own test suite. The keyword actually present IN the department
 * name always wins; only if nothing is, do we fall back to the reverse
 * (department name is itself a substring of a keyword), preferring the
 * closest-length keyword. Returns null rather than guessing when nothing scores.
 */
export function suggestMinistry(departmentName: string): MinistrySuggestion | null {
  const name = normalize(departmentName);
  if (!name || name.length < 3) return null;

  let bestContains: { entry: Portfolio; score: number } | null = null;
  let bestContainedBy: { entry: Portfolio; score: number } | null = null;

  for (const entry of KARNATAKA_PORTFOLIOS) {
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (!k) continue;
      if (name.includes(k)) {
        // Department name contains this keyword phrase - the strong signal. Prefer the longest (most specific) keyword.
        if (!bestContains || k.length > bestContains.score) bestContains = { entry, score: k.length };
      } else if (k.includes(name)) {
        // Department name is a fragment of a longer keyword - weaker signal. Prefer the keyword closest in length (least "extra").
        const closeness = -Math.abs(k.length - name.length);
        if (!bestContainedBy || closeness > bestContainedBy.score) bestContainedBy = { entry, score: closeness };
      }
    }
  }

  const best = bestContains ?? bestContainedBy;
  if (!best) return null;

  return {
    minister: best.entry.minister,
    portfolio: best.entry.portfolio,
    ministryName: `Hon'ble ${best.entry.minister}, Minister for ${best.entry.portfolio}, Government of Karnataka`,
  };
}
