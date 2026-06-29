/**
 * Normalize the variety of date formats Tally exports into `YYYY-MM-DD`,
 * which is what the rest of the app (date filters, month-end bounds,
 * dashboard trend, <input type="date">) expects.
 *
 * Supported inputs:
 *  - `YYYYMMDD`      (Tally XML DATE field, e.g. 20260601)
 *  - `YYYY-MM-DD`    (already normalized, PDF path)
 *  - `DD/MM/YYYY`, `DD-MM-YYYY`
 *  - `DD-Mon-YYYY`   (e.g. 1-Apr-2026)
 *  - Excel serial numbers passed through as strings
 *
 * Returns the original string unchanged if it doesn't match a known shape,
 * so unknown formats fail loudly downstream rather than being silently
 * mis-parsed.
 */
export function normalizeTallyDate(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Tally XML: YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    let yy = dmy[3];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }

  // DD-Mon-YYYY (e.g. 1-Apr-2026)
  const dmon = s.match(/^(\d{1,2})-([A-Za-z]{3})-?(\d{2,4})$/);
  if (dmon) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mm = months[dmon[2].toLowerCase()];
    if (mm) {
      const dd = dmon[1].padStart(2, '0');
      let yy = dmon[3];
      if (yy.length === 2) yy = `20${yy}`;
      return `${yy}-${mm}-${dd}`;
    }
  }

  return s;
}

/**
 * Today's date in IST (Asia/Kolkata), formatted YYYY-MM-DD. The app's
 * "today" filters (dashboard bills-today, print default date) must use IST
 * because the business operates in India — UTC "today" is wrong between
 * 18:30 IST and midnight.
 */
export function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
