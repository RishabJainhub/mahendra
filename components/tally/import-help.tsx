export function TallyImportHelp() {
  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
      <p className="mb-2 font-medium">Don&apos;t know how to export XML from Tally?</p>
      <p className="mb-3 text-blue-900">
        Upload a <strong>PDF</strong> of the sales voucher or invoice — we read the bill and line items
        automatically. XML and Excel still work if you have them.
      </p>
      <details className="text-blue-900">
        <summary className="cursor-pointer font-medium">How to get a Tally bill as PDF</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open the sales voucher / invoice in TallyPrime.</li>
          <li>Press <kbd className="rounded bg-white px-1">Alt</kbd> + <kbd className="rounded bg-white px-1">P</kbd> (Print) or use Print from the menu.</li>
          <li>Choose <strong>Microsoft Print to PDF</strong> or <strong>Save as PDF</strong>.</li>
          <li>Save the file, then upload it here.</li>
        </ol>
        <p className="mt-2 text-xs text-blue-800">
          For highest accuracy, export XML: Gateway of Tally → Display → Day Book → select voucher →
          Export (Alt+E) → XML.
        </p>
      </details>
    </div>
  );
}
