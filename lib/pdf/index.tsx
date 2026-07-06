import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatINR, formatLabelPrice } from '@/lib/pricing';
import {
  chunkLabelsForPages,
  computeLabelGrid,
  expandBillLabels,
  type ExpandedLabel,
  type LabelGrid,
} from '@/lib/pdf/layout';
import type { BillItemPDF, BillPDFData, BillStickerBundle, LayoutPDF } from '@/lib/pdf/types';

export type { BillPDFData, BillItemPDF, LayoutPDF, BillStickerBundle } from '@/lib/pdf/types';
export { labelsPerPage, expandBillLabels, computeLabelGrid } from '@/lib/pdf/layout';

/** Fallback layout when none is configured in the DB.
 *  Matches the reference sticker: ~60mm × 25mm landscape, 4 centered lines. */
export const DEFAULT_LABEL_LAYOUT: LayoutPDF = {
  grid_cols: 3,
  label_w: 170,
  label_h: 68,
  include_fields: [],
};

/** Argox CP-2140 roll labels — physical media: 50mm wide × 25mm tall (landscape on roll).
 *  PDF page MUST match the physical label exactly so the printer feeds one label
 *  per page with no skipping. Windows/Argox driver should be set to Landscape,
 *  media size 50×25mm, auto-rotate OFF. */
export const LABEL_ROLL_WIDTH_PT = 141.73; // 50mm (print-head width)
export const LABEL_ROLL_HEIGHT_PT = 70.87; // 25mm (feed direction)

/**
 * Max characters that fit on one line of a 50mm roll label at the given font
 * size. The label is 141pt wide with 6pt horizontal padding → ~135pt usable.
 * At 14pt Helvetica-Bold the average glyph advance is ~7.5pt, so ~18 chars.
 * We err on the safe side and truncate to 16 with an ellipsis so the
 * description NEVER wraps to a second line (which would push the DNA/MA lines
 * onto the next sticker).
 */
const ROLL_DESC_MAX_CHARS = 16;
const A4_DESC_MAX_CHARS = 22;

/** Truncate to a single line. Long descriptions get an ellipsis — they never wrap. */
function truncateForLabel(text: string, maxChars: number): string {
  const trimmed = (text ?? '').trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1))}…`;
}

const rollStyles = StyleSheet.create({
  rollPage: {
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rollContent: {
    // Wrapper View that actually performs the centering inside the Page.
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rollLine1: {
    // Item description — biggest line, wraps if long.
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 1,
  },
  rollLine2: {
    // Supplier code (HSN) — secondary line.
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 1,
  },
  rollLine3: {
    // MA price — prominent.
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 1,
  },
  rollLine4: {
    // DNA price — prominent.
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
});

/** Minimum label height so 4 stacked lines never overlap on A4 sheets. */
const MIN_LABEL_HEIGHT = 64;

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9 },
  header: { marginBottom: 14 },
  title: { fontSize: 14, marginBottom: 2 },
  meta: { fontSize: 8, color: '#444' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  label: {
    border: '0.5pt solid #000',
    padding: 3,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line1: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 1,
  },
  line2: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 1,
  },
  line3: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 1,
  },
  line4: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
});

function BillHeader({
  bill,
  totalLabels,
  pageNote,
}: {
  bill: BillPDFData;
  totalLabels: number;
  pageNote?: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{bill.tenant_name}</Text>
      {bill.tenant_gstin ? <Text style={styles.meta}>GSTIN: {bill.tenant_gstin}</Text> : null}
      <Text style={styles.meta}>
        Bill: {bill.bill_number} | Date: {bill.bill_date}
      </Text>
      <Text style={styles.meta}>
        Supplier: {bill.supplier_name}
        {bill.supplier_code ? ` (${bill.supplier_code})` : ''}
      </Text>
      <Text style={styles.meta}>
        Total: {formatINR(bill.total_amount)} | Labels: {totalLabels}
        {pageNote ? ` | ${pageNote}` : ''}
      </Text>
    </View>
  );
}

function LabelCell({
  label,
  bill,
  grid,
}: {
  label: ExpandedLabel;
  bill: BillPDFData;
  grid: LabelGrid;
}) {
  const companyCode = bill.supplier_code;
  const itemHsn = label.item.hsn;
  const line2 = companyCode && itemHsn
    ? `${companyCode}(${itemHsn})`
    : companyCode || itemHsn || '';
  const safeHeight = Math.max(grid.labelHeight, MIN_LABEL_HEIGHT);
  return (
    <View
      key={label.key}
      style={[
        styles.label,
        { width: grid.labelWidth, minHeight: safeHeight },
      ]}
    >
      <Text style={styles.line1}>
        {truncateForLabel(label.item.description, A4_DESC_MAX_CHARS)}
      </Text>
      {line2 ? <Text style={styles.line2}>{line2}</Text> : null}
      <Text style={styles.line3}>MA{formatLabelPrice(label.item.ma_price)}B</Text>
      <Text style={styles.line4}>DNA{formatLabelPrice(label.item.dna_price)}B</Text>
    </View>
  );
}

function renderBillPages(
  bill: BillPDFData,
  items: BillItemPDF[],
  layout: LayoutPDF | null | undefined,
  keyPrefix = ''
): React.ReactElement[] {
  const safeLayout = layout ?? DEFAULT_LABEL_LAYOUT;
  const grid = computeLabelGrid(safeLayout);
  const expanded = expandBillLabels(items);
  const pageChunks = chunkLabelsForPages(expanded, grid, true);

  return pageChunks.map((chunk, pageIdx) => (
    <Page key={`${keyPrefix}p-${pageIdx}`} size="A4" style={styles.page}>
      {pageIdx === 0 ? (
        <BillHeader
          bill={bill}
          totalLabels={expanded.length}
          pageNote={
            pageChunks.length > 1
              ? `Page ${pageIdx + 1} of ${pageChunks.length}`
              : undefined
          }
        />
      ) : (
        <Text style={[styles.meta, { marginBottom: 8 }]}>
          {bill.bill_number} — {bill.bill_date} — Page {pageIdx + 1} of {pageChunks.length}
        </Text>
      )}
      <View style={styles.row}>
        {chunk.map((label) => (
          <LabelCell key={label.key} label={label} bill={bill} grid={grid} />
        ))}
      </View>
    </Page>
  ));
}

export function renderBillPDF(
  bill: BillPDFData,
  items: BillItemPDF[],
  layout: LayoutPDF | null | undefined
): React.ReactElement {
  return <Document>{renderBillPages(bill, items, layout)}</Document>;
}

export function renderBulkBillPDF(
  bundles: BillStickerBundle[],
  layout: LayoutPDF | null | undefined
): React.ReactElement {
  const pages = bundles.flatMap((bundle, billIdx) =>
    renderBillPages(bundle.bill, bundle.items, layout, `b${billIdx}-`)
  );

  return <Document>{pages}</Document>;
}

/** Render one label per PDF page, sized for Argox CP-2140 roll (50×25mm on media). */
export function renderLabelRollPDF(
  bundles: BillStickerBundle[]
): React.ReactElement {
  const allLabels = bundles.flatMap((bundle) =>
    expandBillLabels(bundle.items).map((label) => ({
      label,
      bill: bundle.bill,
      key: `${bundle.id ?? bundle.bill.bill_number}-${label.key}`,
    }))
  );

  return (
    <Document>
      {allLabels.map(({ label, bill, key }) => {
        const companyCode = bill.supplier_code;
        const itemHsn = label.item.hsn;
        const line2 = companyCode && itemHsn
          ? `${companyCode}(${itemHsn})`
          : companyCode || itemHsn || '';
        return (
          <Page
            key={key}
            size={[LABEL_ROLL_WIDTH_PT, LABEL_ROLL_HEIGHT_PT]}
            style={rollStyles.rollPage}
          >
            <View style={rollStyles.rollContent}>
              <Text style={rollStyles.rollLine1}>
                {truncateForLabel(label.item.description, ROLL_DESC_MAX_CHARS)}
              </Text>
              {line2 ? <Text style={rollStyles.rollLine2}>{line2}</Text> : null}
              <Text style={rollStyles.rollLine3}>MA{formatLabelPrice(label.item.ma_price)}B</Text>
              <Text style={rollStyles.rollLine4}>DNA{formatLabelPrice(label.item.dna_price)}B</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
