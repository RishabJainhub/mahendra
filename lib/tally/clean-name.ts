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
 * The company code between the name and the DNA/MA label may be numeric
 * ("149") OR alphabetic ("NT", "RJ"). Pass the supplier's known code so it is
 * stripped reliably regardless of format.
 *
 *   "S/N1102 63 DNA1605B"                       → "S/N1102"
 *   "ASHRAY 149 DNA1600B18,200.00PCS1,300.00…"  → "ASHRAY"
 *   "G-3 NT DNA4275B"           (code "NT")      → "G-3"
 *   "S/N797 NT DNA4725B"        (code "NT")      → "S/N797"
 *   "SMART GIRL 215 D/NA1375B"                   → "SMART GIRL"
 *   "540710 HSN 5% SAREES"                       → "540710 HSN 5% SAREES" (no DNA label → preserved)
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function cleanItemNameForLabel(raw: string, companyCode?: string): string {
  if (!raw) return '';

  // Locate the first MA/DNA sticker label (e.g. "DNA4275B", "MA1827B",
  // "D/NA1375B"). Everything from the token before it onward is the supplier's
  // pre-printed sticker info, not the item name.
  const labelMatch = /(?:MA|D\s*\/?\s*NA)\s*\d/i.exec(raw);
  if (labelMatch) {
    let head = raw.slice(0, labelMatch.index).trim();

    // Strip the trailing company-code token — alphabetic ("NT") or numeric
    // ("149") — that sits between the item name and the DNA/MA label.
    const code = (companyCode ?? '').trim();
    if (code) {
      head = head.replace(new RegExp(`\\s+${escapeRegExp(code)}\\s*$`, 'i'), '').trim();
    }
    // Also drop a trailing bare number (the supplier's numeric item code).
    head = head.replace(/\s+\d+\s*$/, '').trim();

    // Strip a leading sl-no digit glued to the name ("2SIVAKASI" → "SIVAKASI").
    head = head.replace(/^\d+(?=[A-Za-z])/, '').trim();

    if (head.length > 0) return head;
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
