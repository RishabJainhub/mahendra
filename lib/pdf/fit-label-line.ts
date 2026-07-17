/** Average glyph width as a fraction of font size (Helvetica-Bold, uppercase). */
const CHAR_WIDTH_RATIO = 0.56;

export type FitLabelLineOptions = {
  /** Usable horizontal space in PDF points. */
  maxWidthPt: number;
  maxFontSize: number;
  minFontSize: number;
};

export type FitLabelLineResult = {
  text: string;
  fontSize: number;
};

function normalizeLabelLine(text: string): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Pick a font size so the full description fits on one label line without "…".
 * Shrinks from maxFontSize down to minFontSize; never truncates.
 */
export function fitLabelDescriptionLine(
  text: string,
  { maxWidthPt, maxFontSize, minFontSize }: FitLabelLineOptions
): FitLabelLineResult {
  const normalized = normalizeLabelLine(text);
  if (!normalized) {
    return { text: '', fontSize: maxFontSize };
  }
  if (normalized.length === 0) {
    return { text: normalized, fontSize: maxFontSize };
  }

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    const estimatedWidth = normalized.length * fontSize * CHAR_WIDTH_RATIO;
    if (estimatedWidth <= maxWidthPt) {
      return { text: normalized, fontSize: Math.round(fontSize * 10) / 10 };
    }
  }

  return { text: normalized, fontSize: minFontSize };
}

/** Argox roll label — 50mm wide, ~6pt horizontal padding. */
export const ROLL_LINE1_FIT: FitLabelLineOptions = {
  maxWidthPt: 132,
  maxFontSize: 14,
  minFontSize: 5,
};

/** Default A4 sticker cell — width varies; use label width minus padding at render time. */
export const A4_LINE1_MAX_FONT = 8;
export const A4_LINE1_MIN_FONT = 4.5;
export const A4_LABEL_HORIZONTAL_PADDING_PT = 8;
