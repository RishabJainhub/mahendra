import {
  chunkLabelsForPages,
  computeLabelGrid,
  expandBillLabels,
  labelsPerPage,
} from '@/lib/pdf/layout';

describe('pdf layout', () => {
  const layout = { grid_cols: 3, label_w: 130, label_h: 60, include_fields: [] };

  it('expands qty into individual labels', () => {
    const expanded = expandBillLabels([
      { description: 'A', ma_price: 100, dna_price: 95, qty: 3 },
      { description: 'B', ma_price: 200, dna_price: 190, qty: 1 },
    ]);
    expect(expanded).toHaveLength(4);
  });

  it('chunks large bills across multiple pages', () => {
    const grid = computeLabelGrid(layout);
    const firstPageCap = labelsPerPage(grid, true);
    const nextPageCap = labelsPerPage(grid, false);

    expect(firstPageCap).toBeGreaterThanOrEqual(30);
    expect(firstPageCap).toBeLessThanOrEqual(55);
    expect(nextPageCap).toBeGreaterThan(firstPageCap);

    const labels = expandBillLabels([
      { description: 'Item', ma_price: 100, dna_price: 95, qty: 120 },
    ]);
    const pages = chunkLabelsForPages(labels, grid, true);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.reduce((n, p) => n + p.length, 0)).toBe(120);
    expect(pages[0].length).toBe(firstPageCap);
    if (pages.length > 1) {
      expect(pages[1].length).toBeLessThanOrEqual(nextPageCap);
    }
  });
});
