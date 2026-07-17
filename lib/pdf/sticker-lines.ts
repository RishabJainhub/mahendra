import { formatLabelPrice } from '@/lib/pricing';
import { cleanItemNameForLabel } from '@/lib/tally/clean-name';
import {
  A4_LABEL_HORIZONTAL_PADDING_PT,
  A4_LINE1_MAX_FONT,
  A4_LINE1_MIN_FONT,
  fitLabelDescriptionLine,
  ROLL_LINE1_FIT,
  type FitLabelLineResult,
} from '@/lib/pdf/fit-label-line';

/**
 * UNIVERSAL sticker layout for every bill (roll + A4 + CSV).
 *
 *   Line 1 — full item name, ONE line, shrink font, never "…" / wrap / split stickers
 *   Line 2 — company code (HSN) only, e.g. DNX(540752) — never on line 1
 *   Line 3 — MA{price}B
 *   Line 4 — DNA{price}B
 *
 * All four lines must stay on the SAME physical sticker. Do not change this
 * without an explicit product decision; see `.cursor/rules/sticker-labels.mdc`.
 */
export type StickerLineFields = {
  description: string;
  hsn?: string | null;
  ma_price: number;
  dna_price: number;
};

export type StickerLines = {
  line1: FitLabelLineResult;
  line2: string;
  line3: string;
  line4: string;
};

export function buildStickerLines(
  item: StickerLineFields,
  companyCode: string | null | undefined,
  mode: 'roll' | 'a4',
  a4LabelWidthPt?: number
): StickerLines {
  const code = (companyCode ?? '').trim();
  const hsn = (item.hsn ?? '').trim();
  const line2 = code && hsn ? `${code}(${hsn})` : code || hsn || '';

  const cleaned = cleanItemNameForLabel(item.description, code || undefined);
  const line1 =
    mode === 'roll'
      ? fitLabelDescriptionLine(cleaned, ROLL_LINE1_FIT)
      : fitLabelDescriptionLine(cleaned, {
          maxWidthPt: Math.max(
            40,
            (a4LabelWidthPt ?? 170) - A4_LABEL_HORIZONTAL_PADDING_PT
          ),
          maxFontSize: A4_LINE1_MAX_FONT,
          minFontSize: A4_LINE1_MIN_FONT,
        });

  return {
    line1,
    line2,
    line3: `MA${formatLabelPrice(item.ma_price)}B`,
    line4: `DNA${formatLabelPrice(item.dna_price)}B`,
  };
}
