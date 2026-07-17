import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatINR } from '@/lib/pricing';
import {
  chunkLabelsForPages,
  computeLabelGrid,
  expandBillLabels,
  type ExpandedLabel,
  type LabelGrid,
} from '@/lib/pdf/layout';
import { buildStickerLines } from '@/lib/pdf/sticker-lines';
import type { BillItemPDF, BillPDFData, BillStickerBundle, LayoutPDF } from '@/lib/pdf/types';

export type { BillPDFData, BillItemPDF, LayoutPDF, BillStickerBundle } from '@/lib/pdf/types';
export { labelsPerPage, expandBillLabels, computeLabelGrid } from '@/lib/pdf/layout';
export { fitLabelDescriptionLine, ROLL_LINE1_FIT } from '@/lib/pdf/fit-label-line';
export { buildStickerLines } from '@/lib/pdf/sticker-lines';

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

const rollStyles = StyleSheet.create({
  rollPage: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rollContent: {
    width: '100%',
    maxHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rollLine1: {
    // Full item name on ONE line — font size shrinks; never wraps / never "…".
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 0.5,
    maxWidth: '100%',
  },
  rollLine2: {
    // Company code (HSN) — secondary line.
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 0.5,
    maxWidth: '100%',
  },
  rollLine3: {
    // MA price — prominent.
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 0.5,
    maxWidth: '100%',
  },
  rollLine4: {
    // DNA price — must stay on THIS sticker, never spill to the next page.
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    maxWidth: '100%',
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
  const safeHeight = Math.max(grid.labelHeight, MIN_LABEL_HEIGHT);
  const { line1, line2, line3, line4 } = buildStickerLines(
    label.item,
    bill.supplier_code,
    'a4',
    grid.labelWidth
  );
  return (
    <View
      key={label.key}
      style={[
        styles.label,
        { width: grid.labelWidth, minHeight: safeHeight },
      ]}
    >
      <Text style={[styles.line1, { fontSize: line1.fontSize }]} wrap={false}>
        {line1.text}
      </Text>
      {line2 ? (
        <Text style={styles.line2} wrap={false}>
          {line2}
        </Text>
      ) : null}
      <Text style={styles.line3} wrap={false}>
        {line3}
      </Text>
      <Text style={styles.line4} wrap={false}>
        {line4}
      </Text>
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
        const { line1, line2, line3, line4 } = buildStickerLines(
          label.item,
          bill.supplier_code,
          'roll'
        );
        return (
          <Page
            key={key}
            size={[LABEL_ROLL_WIDTH_PT, LABEL_ROLL_HEIGHT_PT]}
            style={rollStyles.rollPage}
            wrap={false}
          >
            <View style={rollStyles.rollContent} wrap={false}>
              <Text style={[rollStyles.rollLine1, { fontSize: line1.fontSize }]} wrap={false}>
                {line1.text}
              </Text>
              {line2 ? (
                <Text style={rollStyles.rollLine2} wrap={false}>
                  {line2}
                </Text>
              ) : null}
              <Text style={rollStyles.rollLine3} wrap={false}>
                {line3}
              </Text>
              <Text style={rollStyles.rollLine4} wrap={false}>
                {line4}
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
