/** Optional support line shown on login (suppliers — forgot password). */
export function getSupportPhone(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();
  return raw || null;
}

export function getSupportPhoneTel(): string | null {
  const phone = getSupportPhone();
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits || null;
}
