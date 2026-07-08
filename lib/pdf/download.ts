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

const PRINT_IFRAME_ID = 'pdf-print-iframe';

/**
 * Remove the iframe (and revoke the blob URL) left behind by a PREVIOUS
 * print. Never touches the URL of the print currently starting.
 */
function removeLingeringPrintIframe(): void {
  const el = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;
  if (!el) return;
  if (el.dataset.blobUrl) URL.revokeObjectURL(el.dataset.blobUrl);
  el.parentNode?.removeChild(el);
}

/**
 * Open the browser print dialog directly for a PDF document, without saving
 * the file to disk first. Uses a hidden iframe so the user stays on the
 * current page. Falls back to opening the PDF in a new tab if the browser
 * blocks iframe printing (some PDF viewers don't expose contentWindow.print).
 *
 * The blob URL must stay alive until the print dialog has consumed it, so it
 * is only revoked when the NEXT print starts (or after afterprint fires) —
 * never before the iframe loads.
 */
export async function printPdfDocument(doc: PdfDocument): Promise<void> {
  const blob = await pdf(doc as never).toBlob();
  const url = URL.createObjectURL(blob);

  // Clean up the previous print's iframe + URL, not this one's.
  removeLingeringPrintIframe();

  const iframe = document.createElement('iframe');
  iframe.id = PRINT_IFRAME_ID;
  iframe.dataset.blobUrl = url;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.src = url;

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const fallbackTimer = setTimeout(() => {
      // PDF viewer didn't load in time — open in a new tab instead. The URL
      // stays alive for the tab; it is revoked on the next print.
      window.open(url, '_blank', 'noopener');
      settle();
    }, 4000);

    iframe.onload = () => {
      clearTimeout(fallbackTimer);
      try {
        const w = iframe.contentWindow;
        if (!w) throw new Error('no contentWindow');
        // When the dialog closes we can safely clean up. Not all browsers
        // fire afterprint for iframes, so the next print also sweeps.
        w.addEventListener(
          'afterprint',
          () => {
            removeLingeringPrintIframe();
            settle();
          },
          { once: true }
        );
        w.focus();
        w.print();
        // Resolve shortly after the dialog opens so the UI unblocks. The
        // iframe stays mounted — removing it would kill an open dialog.
        setTimeout(settle, 1500);
      } catch {
        window.open(url, '_blank', 'noopener');
        settle();
      }
    };

    document.body.appendChild(iframe);
  });
}
