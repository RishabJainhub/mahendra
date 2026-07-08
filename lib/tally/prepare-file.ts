'use client';

/**
 * Client-side helpers shared by the admin and supplier import forms:
 * file-type detection, inline-vs-storage preparation, and supplier
 * auto-detection from the parsed party name.
 */

import { arrayBufferToBase64 } from '@/lib/file-utils';
import { uploadTallyFileToStorage, TALLY_INLINE_MAX_BYTES } from '@/lib/tally/upload';

export { matchSupplierByParty } from '@/lib/tally/match-supplier';

export type ImportFileType = 'xml' | 'xlsx' | 'xls' | 'csv' | 'pdf';

export type PreparedImportFile = {
  fileName: string;
  fileType: ImportFileType;
  fileContent?: string;
  storagePath?: string;
  mappingId?: string;
};

export function detectImportFileType(fileName: string): ImportFileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xls')) return 'xls';
  return 'xlsx';
}

/** Spreadsheet types are the only ones that can use a column mapping. */
export function isSpreadsheet(fileType: ImportFileType): boolean {
  return fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv';
}

/**
 * Read a file into the shape the import server actions expect. Small files
 * are inlined (base64 / raw XML text); large ones go to Supabase Storage.
 */
export async function prepareImportFile(
  file: File,
  mappingId?: string,
  onProgress?: (msg: string) => void
): Promise<PreparedImportFile> {
  const fileType = detectImportFileType(file.name);
  const effectiveMapping = isSpreadsheet(fileType) ? mappingId : undefined;

  if (file.size > TALLY_INLINE_MAX_BYTES) {
    onProgress?.(`Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB to secure storage…`);
    const { path } = await uploadTallyFileToStorage(file);
    return { fileName: file.name, fileType, storagePath: path, mappingId: effectiveMapping };
  }

  onProgress?.('Reading file…');
  const fileContent =
    fileType === 'xml'
      ? await file.text()
      : arrayBufferToBase64(await file.arrayBuffer());
  return { fileName: file.name, fileType, fileContent, mappingId: effectiveMapping };
}

