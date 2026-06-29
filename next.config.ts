import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bwip-js', 'pdf-parse'],
  // Tally imports (PDF/XLSX) are sent as base64 through server actions and can
  // be several MB. Default 1MB would reject most real Tally exports.
  serverActions: {
    bodySizeLimit: '16mb',
  },
};

export default nextConfig;
