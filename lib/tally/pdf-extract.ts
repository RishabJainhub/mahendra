/**
 * Robust PDF text extraction for Tally invoices.
 *
 * Tally-exported PDFs often use non-standard cross-reference tables that make
 * the legacy pdf-parse (PDF.js v1) throw "bad XRef entry". We try the modern
 * unpdf build (PDF.js v5 with recovery) first, then fall back to pdf-parse.
 */

const XREF_ERROR_RE = /bad\s*XRef|Invalid\s*XRef|xref/i;

function isXRefError(message: string): boolean {
  return XREF_ERROR_RE.test(message);
}

async function extractWithUnpdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer), {
    // Allow PDF.js recovery paths for malformed Tally XRef tables.
    stopAtErrors: false,
  });
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdfParse(buffer);
  return (data.text ?? '').trim();
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (!buffer?.length) {
    throw new Error('PDF file is empty');
  }

  const errors: string[] = [];

  try {
    const text = await extractWithUnpdf(buffer);
    if (text.length > 0) return text;
    errors.push('unpdf: no readable text');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`unpdf: ${msg}`);
  }

  try {
    const text = await extractWithPdfParse(buffer);
    if (text.length > 0) return text;
    errors.push('pdf-parse: no readable text');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`pdf-parse: ${msg}`);
  }

  const combined = errors.join('; ');
  if (errors.some((e) => isXRefError(e))) {
    throw new Error(
      'Could not read this PDF — the file structure is invalid. Re-export from Tally as XML, or use Print to PDF and try again.'
    );
  }

  throw new Error(
    combined
      ? `Could not extract text from PDF (${combined})`
      : 'Could not extract text from PDF'
  );
}
