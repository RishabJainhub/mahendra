/**
 * Extract an HSN code from a Tally line-item description.
 *
 * Tally exports sometimes put the HSN in a dedicated field/column (handled
 * elsewhere), but very often it is embedded in the item name itself. Common
 * patterns seen in Indian textile/saree invoices:
 *
 *   "540710 HSN 5% SAREES"        -> 540710   (leading 6-digit)
 *   "HSN 540710 SAREES"           -> 540710   (HSN keyword)
 *   "HSN:540710 Cotton"           -> 540710
 *   "RJ 540741"                   -> 540741   (leading 6-digit after token)
 *   "SAREES 540710"               -> 540710   (trailing 6-digit)
 *   "6204 WOMENS DRESS 540752"    -> 540752
 *
 * HSN codes in India are 4–8 digit numeric. We avoid 1-3 digit numbers (sl no,
 * qty, gst %) and very long numbers (amounts, ean codes).
 */

const HSN_KEYWORD_RE = /\bHSN[:\s]*#?\s*(\d{4,8})\b/i;
const LEADING_HSN_RE = /^\s*(?:[A-Za-z]{1,4}\s+)?(\d{4,8})\b/;
const ANY_HSN_TOKEN_RE = /\b(\d{4,8})\b/g;

/** Common HSN prefixes for textiles / sarees / garments. */
const KNOWN_HSN_PREFIXES = new Set([
  '50', '51', '52', '53', '54', '55', '56', '57', '58', // silk, cotton, man-made, wool
  '60', '61', '62', '63', // knitted / woven garments
  '5208', '5209', '5210', '5211', '5212',
  '5407', '5408', '5512', '5513', '5514', '5515', '5516',
  '5007',
]);

function hasKnownPrefix(candidate: string): boolean {
  return (
    KNOWN_HSN_PREFIXES.has(candidate.slice(0, 4)) ||
    KNOWN_HSN_PREFIXES.has(candidate.slice(0, 2))
  );
}

export function extractHsnFromDescription(description: string | null | undefined): string | undefined {
  if (!description) return undefined;
  const text = description.trim();
  if (!text) return undefined;

  // 1. Explicit "HSN <digits>" marker — strongest signal.
  const keywordMatch = text.match(HSN_KEYWORD_RE);
  if (keywordMatch) return keywordMatch[1];

  // 2. Leading 4-8 digit number (optionally preceded by a short alpha token
  //    like "RJ"). 4-digit HSNs are valid; we accept them here and rely on the
  //    known-prefix check below to filter false positives when needed.
  const leadingMatch = text.match(LEADING_HSN_RE);
  if (leadingMatch) {
    const candidate = leadingMatch[1];
    if (candidate.length >= 6 || hasKnownPrefix(candidate)) {
      return candidate;
    }
  }

  // 3. Any 4-8 digit token that starts with a known textile HSN prefix.
  for (const m of text.matchAll(ANY_HSN_TOKEN_RE)) {
    const candidate = m[1];
    if (hasKnownPrefix(candidate)) {
      return candidate;
    }
  }

  // 4. Fallback: a single 6-8 digit token (no ambiguity).
  const allTokens = text.match(/\b\d{6,8}\b/g);
  if (allTokens && allTokens.length === 1) {
    return allTokens[0];
  }

  return undefined;
}

/**
 * Strip the HSN token from a description so the cleaned name doesn't repeat it
 * on the printed label. "540710 HSN 5% SAREES" -> "SAREES".
 */
export function stripHsnFromDescription(description: string, hsn: string): string {
  if (!hsn) return description;
  return description
    .replace(new RegExp(`\\bHSN[:\\s]*#?\\s*${hsn}\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b${hsn}\\b`, 'g'), ' ')
    .replace(/\bHSN\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
