type BarcodeOpts = {
  data: string;
  type?: string;
  scale?: number;
  height?: number;
};

export async function generateBarcodePng(opts: BarcodeOpts): Promise<Buffer> {
  const bwipjs = await import('bwip-js');
  const png = await bwipjs.default.toBuffer({
    bcid: opts.type ?? 'code128',
    text: opts.data,
    scale: opts.scale ?? 2,
    height: opts.height ?? 10,
    includetext: false,
  });
  return png;
}
