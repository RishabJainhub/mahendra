import { buildStickerLines } from '@/lib/pdf/sticker-lines';

describe('buildStickerLines — universal label rule', () => {
  const item = {
    description: 'NEW AJRAK GALLA CHOKDA DNX DNA2180B',
    hsn: '540752',
    ma_price: 2630,
    dna_price: 2180,
  };

  it('puts full name on line 1, code+HSN on line 2, MA/DNA on 3/4', () => {
    const lines = buildStickerLines(item, 'DNX', 'roll');
    expect(lines.line1.text).toBe('NEW AJRAK GALLA CHOKDA');
    expect(lines.line1.text).not.toContain('…');
    expect(lines.line1.text).not.toContain('DNX');
    expect(lines.line2).toBe('DNX(540752)');
    expect(lines.line3).toBe('MA2630B');
    expect(lines.line4).toBe('DNA2180B');
  });

  it('never puts company code on line 1', () => {
    const lines = buildStickerLines(
      { ...item, description: 'GAJJI AJRAK PATTA DNX' },
      'DNX',
      'roll'
    );
    expect(lines.line1.text).toBe('GAJJI AJRAK PATTA');
    expect(lines.line2).toBe('DNX(540752)');
  });
});
