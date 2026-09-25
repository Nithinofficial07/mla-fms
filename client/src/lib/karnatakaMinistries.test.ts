import { describe, it, expect } from 'vitest';
import { suggestMinistry } from './karnatakaMinistries';

describe('suggestMinistry', () => {
  it('matches a plain department name to its current minister and portfolio', () => {
    const s = suggestMinistry('Agriculture Department');
    expect(s?.minister).toBe('P. M. Narendraswamy');
    expect(s?.portfolio).toBe('Agriculture');
    expect(s?.ministryName).toContain('Government of Karnataka');
  });

  it('is not confused by demo/seed suffixes or "Department of" phrasing', () => {
    const s = suggestMinistry('Department of Health (DEMO)');
    expect(s?.minister).toBe('U. T. Khader');
    expect(s?.portfolio).toBe('Health & Family Welfare');
  });

  it('picks the more specific portfolio when a minister holds several (Home vs IT&BT)', () => {
    expect(suggestMinistry('Home Department')?.portfolio).toBe('Home');
    expect(suggestMinistry('Information Technology and Biotechnology')?.portfolio).toBe('Information Technology & Biotechnology');
  });

  it('returns null rather than guessing when nothing matches', () => {
    expect(suggestMinistry('Zonal Coordination Cell')).toBeNull();
    expect(suggestMinistry('')).toBeNull();
  });

  it('covers the realistic line-department roster a constituency office would have', () => {
    const expected: Record<string, string> = {
      'Revenue Department': 'G. Parameshwara',
      'Health and Family Welfare': 'U. T. Khader',
      'Public Works Department': 'Satish Jarkiholi',
      'Primary and Secondary Education': 'Madhu Bangarappa',
      'Higher Education Department': 'Basavaraj Rayareddy',
      'Horticulture Department': 'S. S. Mallikarjun',
      'Animal Husbandry and Veterinary Services': 'C. Puttarangashetty',
      'Fisheries Department': 'K. S. Basavanthappa',
      'Social Welfare Department': 'K. H. Muniyappa',
      'Rural Development and Panchayat Raj': 'Eshwara Khandre',
      'Urban Development Department': 'Yathindra Siddaramaiah',
      'Minor Irrigation Department': 'Ajay Singh',
      'Water Resources Department': 'N. Chaluvaraya Swamy',
      'Forest Department': 'Ramalinga Reddy',
      'BESCOM (Energy)': 'K. J. George',
      'Food and Civil Supplies Department': 'Rizwan Arshad',
      'Labour Department': 'Santosh Lad',
      'Co-operation Department': 'Laxman Savadi',
      'District Industries Centre': 'M. B. Patil',
      'Kannada and Culture Department': 'Shivaraj Tangadagi',
      'Transport Department (RTO)': 'Byrathi Suresh',
      'Housing Department': 'B. Z. Zameer Ahmed Khan',
      'Excise Department': 'K. M. Shivalinge Gowda',
      'Sericulture Department': 'C. Puttarangashetty',
    };
    for (const [dept, minister] of Object.entries(expected)) {
      expect(suggestMinistry(dept)?.minister, `"${dept}" should map to ${minister}`).toBe(minister);
    }
  });
});
