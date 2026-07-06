declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: (buffer: Buffer) => Promise<{
    text: string;
    numpages: number;
    numrender_pages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string | null;
  }>;
  export default pdfParse;
}
