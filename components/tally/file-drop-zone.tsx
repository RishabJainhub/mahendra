'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
};

const ACCEPT = '.xml,.xlsx,.xls,.csv,.pdf,application/pdf,text/csv';

/**
 * Drag-and-drop file target with a click-to-browse fallback. Accepts the
 * same file types as the import actions (PDF, XML, Excel, CSV).
 */
export function FileDropZone({ onFiles, disabled = false, multiple = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function emit(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">
        {dragging ? 'Drop to import' : `Drop bill file${multiple ? 's' : ''} here, or click to browse`}
      </p>
      <p className="text-xs text-muted-foreground">
        PDF, XML, Excel (.xlsx / .xls), or CSV{multiple ? ' — several files at once are imported one by one' : ''}. Up to 50 MB each.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
