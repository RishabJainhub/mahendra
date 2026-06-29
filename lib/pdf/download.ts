'use client';

import type { ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';

type PdfDocument = ReactElement;

export async function downloadPdfDocument(doc: PdfDocument, fileName: string): Promise<Blob> {
  const blob = await pdf(doc as never).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return blob;
}

export async function createPdfBlob(doc: PdfDocument): Promise<Blob> {
  return pdf(doc as never).toBlob();
}

export function createPdfPreviewUrl(doc: PdfDocument): Promise<string> {
  return pdf(doc as never).toBlob().then((blob) => URL.createObjectURL(blob));
}
