/** Canonical public site URL for metadata, OG tags, and server-action CSRF allowlist. */
export function getSiteUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return undefined;
}

/** Host:port values allowed to invoke server actions (production + local dev). */
export function getServerActionAllowedOrigins(): string[] {
  const origins = new Set<string>([
    'localhost:3001',
    '127.0.0.1:3001',
    '192.168.0.165:3001',
  ]);

  const site = getSiteUrl();
  if (site) {
    try {
      origins.add(new URL(site).host);
    } catch {
      // ignore invalid URL
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) origins.add(vercel);

  return [...origins];
}
