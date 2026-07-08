/**
 * Fuzzy-match the party name parsed out of a bill file against the supplier
 * list. Pure module (no client/server deps) so it is testable everywhere.
 */

function normalizeName(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Compact form drops spaces entirely so "L.L.P." matches "LLP". */
function compactName(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

/**
 * Exact normalized match wins; then exact compact match (punctuation-proof);
 * then containment either way (longest supplier name first, so
 * "NICE TEX FAB LLP" beats "NICE"). Returns the supplier id or null when
 * nothing matches confidently.
 */
export function matchSupplierByParty(
  party: string,
  suppliers: { id: string; name: string }[]
): string | null {
  const normParty = normalizeName(party);
  const compactParty = compactName(party);
  if (!normParty) return null;

  const candidates = suppliers
    .map((s) => ({ id: s.id, norm: normalizeName(s.name), compact: compactName(s.name) }))
    .filter((s) => s.norm.length >= 3)
    .sort((a, b) => b.norm.length - a.norm.length);

  for (const c of candidates) {
    if (c.norm === normParty || c.compact === compactParty) return c.id;
  }
  for (const c of candidates) {
    if (
      normParty.includes(c.norm) ||
      c.norm.includes(normParty) ||
      compactParty.includes(c.compact) ||
      c.compact.includes(compactParty)
    ) {
      return c.id;
    }
  }
  return null;
}
