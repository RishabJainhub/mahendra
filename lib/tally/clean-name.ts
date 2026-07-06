/**
 * Browser-safe item-name cleaner for label rendering.
 *
 * Strips the supplier's pre-printed sticker info (company code + DNA/MA label)
 * and any trailing amounts / unit markers from a raw Tally description so the
 * printed label shows only the item name.
 *
 * Lives in its own module (not pdf-parser.ts) so it can be imported from
 * client components without pulling in the Node-only `pdf-parse` dependency.
 *
 *   "S/N1102 63 DNA1605B"                       → "S/N1102"
 *   "ASHRAY 149 DNA1600B18,200.00PCS1,300.00…"  → "ASHRAY"
 *   "DHURANDHAR-2 149 DNA1540B"                 → "DHURANDHAR-2"
 *   "SMART GIRL 215 D/NA1375B"                  → "SMART GIRL"
 *   "540710 HSN 5% SAREES"                      → "540710 HSN 5% SAREES" (no DNA label → preserved)
 */
export function cleanItemNameForLabel(raw: string): string {
  if (!raw) return '';

  // If the description has a "<company_code> <DNA/MA label>" pattern, take
  // everything BEFORE the company code — that's the item name.
  const labelMatch = raw.match(
    /^(.+?)\s+\d+\s+(?:MA|D\s*\/?\s*NA)\s*\d+(?:\.\d+)?\s*B/i
  );
  if (labelMatch && labelMatch[1].trim().length > 0) {
    // Strip a leading sl-no digit glued to the name ("2SIVAKASI" → "SIVAKASI").
    return labelMatch[1].trim().replace(/^\d+(?=[A-Za-z])/, '').trim();
  }

  // No DNA/MA label — strip amounts, units, decimals, and GST/HSN tails but
  // keep standalone numbers (they may be HSNs or part of the name).
  return raw
    .replace(/\d+\s*%\s*\d{4,8}/gi, ' ')
    .replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?/g, ' ')
    .replace(/\d+\.\d{2}/g, ' ')
    .replace(/\b(PCS|NOS|MTRS?|MT|KG|GMS?|GM|BOXES?|PR|PRS|SET|SETS?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
