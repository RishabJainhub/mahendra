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

/**
 * Open the browser print dialog directly for a PDF document, without saving
 * the file to disk first. Uses a hidden iframe so the user stays on the
 * current page. Falls back to opening the PDF in a new tab if the browser
 * blocks iframe printing (some PDF viewers don't expose contentWindow.print).
 */
export async function printPdfDocument(doc: PdfDocument): Promise<void> {
  const blob = await pdf(doc as never).toBlob();
  const url = URL.createObjectURL(blob);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    const el = document.getElementById('pdf-print-iframe');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };

  // If a previous print iframe lingers, remove it first.
  cleanup();

  const iframe = document.createElement('iframe');
  iframe.id = 'pdf-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.src = url;

  const printed = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      // Browser didn't fire load in time — fall back to a new tab.
      window.open(url, '_blank', 'noopener');
      resolve();
    }, 4000);

    iframe.onload = () => {
      clearTimeout(timeout);
      try {
        const w = iframe.contentWindow;
        if (w) {
          w.focus();
          // Some browsers fire afterprint, others don't. Resolve either way.
          const done = () => {
            cleanup();
            resolve();
          };
          w.addEventListener('afterprint', done, { once: true });
          setTimeout(done, 8000);
          w.print();
        } else {
          window.open(url, '_blank', 'noopener');
          cleanup();
          resolve();
        }
      } catch {
        window.open(url, '_blank', 'noopener');
        cleanup();
        resolve();
      }
    };
  });

  document.body.appendChild(iframe);
  await printed;
}
