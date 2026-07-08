import { matchSupplierByParty } from '@/lib/tally/match-supplier';

const suppliers = [
  { id: 'koyal', name: 'KOYAL DESIGNER' },
  { id: 'maruti', name: 'MARUTI CREATION' },
  { id: 'nice', name: 'NICE TEX FAB LLP' },
  { id: 'sammanita', name: 'SAMMANITA FASHION' },
];

describe('matchSupplierByParty', () => {
  it('matches an exact party name', () => {
    expect(matchSupplierByParty('KOYAL DESIGNER', suppliers)).toBe('koyal');
  });

  it('is case- and punctuation-insensitive', () => {
    expect(matchSupplierByParty('koyal designer', suppliers)).toBe('koyal');
    expect(matchSupplierByParty('NICE TEX FAB L.L.P.', suppliers)).toBe('nice');
  });

  it('matches when the party has extra prefixes/suffixes', () => {
    expect(matchSupplierByParty('M/S KOYAL DESIGNER SURAT', suppliers)).toBe('koyal');
    expect(matchSupplierByParty('SAMMANITA FASHION PVT LTD', suppliers)).toBe('sammanita');
  });

  it('matches when the supplier record is more complete than the party', () => {
    expect(matchSupplierByParty('NICE TEX FAB', suppliers)).toBe('nice');
  });

  it('returns null when nothing matches', () => {
    expect(matchSupplierByParty('UNKNOWN TRADERS', suppliers)).toBeNull();
    expect(matchSupplierByParty('', suppliers)).toBeNull();
  });
});
