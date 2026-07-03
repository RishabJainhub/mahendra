import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import { getServerActionAllowedOrigins } from './lib/site-url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Extra dev hosts from ALLOWED_DEV_ORIGINS env (comma-separated). */
const extraDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  serverExternalPackages: ['bwip-js', 'pdf-parse'],
  turbopack: {
    root: projectRoot,
  },
  // Windows/other devices open the Mac dev server at http://192.168.x.x:3001.
  // Without this, HTML loads but _next assets + server actions are blocked (no data).
  allowedDevOrigins: [
    '192.168.0.*',
    '192.168.1.*',
    'Rishabs-MacBook-Pro.local',
    ...extraDevOrigins,
  ],
  // Tally imports (PDF/XLSX) are sent as base64 through server actions and can
  // be several MB. Default 1MB would reject most real Tally exports.
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
      allowedOrigins: getServerActionAllowedOrigins(),
    },
  },
};

export default nextConfig;
