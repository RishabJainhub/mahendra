'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { createPdfPreviewUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdf/download';
import { Button } from '@/components/ui/button';
import { Printer, FileDown } from 'lucide-react';

type Props = {
  doc: ReactElement | null;
  fileName: string;
  /** Return false when the status update failed so we can show an error. */
  onMarkPrinted?: () => Promise<boolean | void>;
  marked?: boolean;
  markLabel?: string;
};

export function PdfPrintTools({
  doc,
  fileName,
  onMarkPrinted,
  marked = false,
  markLabel = 'Mark as Printed',
}: Props) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [locallyMarked, setLocallyMarked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMarked = marked || locallyMarked;

  useEffect(() => {
    setLocallyMarked(false);
  }, [doc, fileName]);

  useEffect(() => {
    if (!doc || !showPreview) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    void createPdfPreviewUrl(doc).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [doc, showPreview]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const tryAutoMark = useCallback(async () => {
    if (!onMarkPrinted || isMarked) return;
    setMarking(true);
    try {
      const success = await onMarkPrinted();
      if (success !== false) {
        setLocallyMarked(true);
      } else {
        setError('Could not mark as printed. Click "Mark as Printed" or try again.');
      }
    } catch {
      setError('Could not mark as printed. Click "Mark as Printed" or try again.');
    } finally {
      setMarking(false);
    }
  }, [onMarkPrinted, isMarked]);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadPdfDocument(doc, fileName);
      // Argox / label-printer workflow usually downloads then prints externally.
      await tryAutoMark();
    } catch {
      setError('PDF download failed. Try again or use a smaller batch.');
    } finally {
      setDownloading(false);
    }
  }, [doc, fileName, tryAutoMark]);

  const handlePrint = useCallback(async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      await printPdfDocument(doc);
      await tryAutoMark();
    } catch {
      setError('Direct print failed. Use Download PDF and print from your PDF viewer.');
    } finally {
      setBusy(false);
    }
  }, [doc, tryAutoMark]);

  const handleManualMark = useCallback(async () => {
    if (!onMarkPrinted || isMarked) return;
    setMarking(true);
    setError(null);
    try {
      const success = await onMarkPrinted();
      if (success !== false) {
        setLocallyMarked(true);
      } else {
        setError('Could not mark as printed. Refresh the page and try again.');
      }
    } catch {
      setError('Could not mark as printed. Refresh the page and try again.');
    } finally {
      setMarking(false);
    }
  }, [onMarkPrinted, isMarked]);

  if (!doc) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handlePrint()} disabled={busy}>
          <Printer className="mr-1.5 h-4 w-4" />
          {busy ? 'Opening print…' : 'Print'}
        </Button>
        <Button type="button" variant="outline" onClick={() => void handleDownload()} disabled={downloading}>
          <FileDown className="mr-1.5 h-4 w-4" />
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
        {onMarkPrinted && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleManualMark()}
            disabled={isMarked || marking}
          >
            {isMarked ? 'Marked as Printed' : marking ? 'Marking…' : markLabel}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {showPreview && previewUrl && (
        <div className="h-[75vh] overflow-hidden rounded-lg border">
          <iframe src={previewUrl} title="Label PDF preview" className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
