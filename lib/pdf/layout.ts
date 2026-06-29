import type { BillItemPDF, LayoutPDF } from '@/lib/pdf/types';

/** A4 page size in PDF points. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const PAGE_PADDING = 24;
export const LABEL_MARGIN = 4;
export const BILL_HEADER_HEIGHT = 92;

export type LabelGrid = {
  labelWidth: number;
  labelHeight: number;
  cols: number;
  rowHeight: number;
};

export type ExpandedLabel = {
  item: BillItemPDF;
  key: string;
};

export function computeLabelGrid(layout: LayoutPDF): LabelGrid {
  const labelWidth = Math.max(layout.label_w || 170, 130);
  const labelHeight = Math.max(layout.label_h || 68, 64);
  const innerWidth = A4_WIDTH - PAGE_PADDING * 2;
  const cols =
    layout.grid_cols > 0
      ? layout.grid_cols
      : Math.max(1, Math.floor(innerWidth / (labelWidth + LABEL_MARGIN)));

  return {
    labelWidth,
    labelHeight,
    cols,
    rowHeight: labelHeight + LABEL_MARGIN,
  };
}

export function labelsPerPage(grid: LabelGrid, withBillHeader: boolean): number {
  const innerHeight = A4_HEIGHT - PAGE_PADDING * 2;
  const headerReserve = withBillHeader ? BILL_HEADER_HEIGHT : 0;
  const rows = Math.max(1, Math.floor((innerHeight - headerReserve) / grid.rowHeight));
  return grid.cols * rows;
}

export function expandBillLabels(items: BillItemPDF[]): ExpandedLabel[] {
  return items.flatMap((item, itemIdx) => {
    const copies = Math.max(1, Math.floor(Number(item.qty) || 1));
    return Array.from({ length: copies }, (_, copyIdx) => ({
      item,
      key: `${itemIdx}-${copyIdx}`,
    }));
  });
}

/** Split labels across pages — first page may include a bill header. */
export function chunkLabelsForPages(
  labels: ExpandedLabel[],
  grid: LabelGrid,
  firstPageHasHeader: boolean
): ExpandedLabel[][] {
  if (labels.length === 0) return [];

  const firstCap = labelsPerPage(grid, firstPageHasHeader);
  const nextCap = labelsPerPage(grid, false);
  const pages: ExpandedLabel[][] = [];
  let offset = 0;

  pages.push(labels.slice(0, firstCap));
  offset = firstCap;

  while (offset < labels.length) {
    pages.push(labels.slice(offset, offset + nextCap));
    offset += nextCap;
  }

  return pages;
}
