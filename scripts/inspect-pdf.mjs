#!/usr/bin/env node
// Diagnostic: print the raw text that pdf-parse extracts from a Tally PDF.
// Usage:
//   node scripts/inspect-pdf.mjs /path/to/Sales_1885_26-27.pdf
//   node scripts/inspect-pdf.mjs                              # defaults to tmp/sample.pdf

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const pdfParse = req('pdf-parse');

const input = process.argv[2] ?? 'tmp/sample.pdf';
const resolved = path.resolve(input);

if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  console.error('Drop the PDF at tmp/sample.pdf, or pass a path:');
  console.error('  node scripts/inspect-pdf.mjs ~/Downloads/Sales_1885_26-27.pdf');
  process.exit(1);
}

const buf = fs.readFileSync(resolved);
const { text, numpages } = await pdfParse(buf);

const lines = text.split(/\r?\n/).map((l) => l.trim());

console.log(`File:    ${resolved}`);
console.log(`Pages:   ${numpages}`);
console.log(`Lines:   ${lines.length}`);
console.log('─'.repeat(80));

let i = 0;
for (const line of lines) {
  if (!line) continue;
  console.log(`${String(++i).padStart(4)} | ${line}`);
}
