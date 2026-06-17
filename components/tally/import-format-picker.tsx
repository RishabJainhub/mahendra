'use client';

import { cn } from '@/lib/utils';

export type ImportFormat = 'pdf' | 'xml' | 'excel';

const FORMATS: {
  id: ImportFormat;
  label: string;
  sublabel: string;
  accept: string;
  recommended?: boolean;
}[] = [
  {
    id: 'pdf',
    label: 'PDF',
    sublabel: 'Print from Tally → Save as PDF',
    accept: '.pdf,application/pdf',
    recommended: true,
  },
  {
    id: 'xml',
    label: 'XML',
    sublabel: 'Export from Tally (most accurate)',
    accept: '.xml,text/xml,application/xml',
  },
  {
    id: 'excel',
    label: 'Excel',
    sublabel: '.xlsx or .xls spreadsheet',
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
  },
];

type Props = {
  value: ImportFormat;
  onChange: (format: ImportFormat) => void;
};

export function ImportFormatPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Import format</label>
      <div className="grid gap-2 sm:grid-cols-3">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={cn(
              'relative rounded-lg border-2 p-4 text-left transition-colors',
              value === f.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted/40'
            )}
          >
            {f.recommended && (
              <span className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                Easiest
              </span>
            )}
            <div className="text-base font-semibold">{f.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{f.sublabel}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function acceptForFormat(format: ImportFormat): string {
  return FORMATS.find((f) => f.id === format)?.accept ?? '.pdf,application/pdf';
}

export function fileTypeFromFormat(format: ImportFormat, fileName: string): 'pdf' | 'xml' | 'xlsx' | 'xls' {
  const lower = fileName.toLowerCase();
  if (format === 'pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (format === 'xml' || lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.xls')) return 'xls';
  return 'xlsx';
}
