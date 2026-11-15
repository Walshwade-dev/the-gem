const KENYA_E164_REGEX = /^\+254[17]\d{8}$/;

export function normalizeKenyaPhoneToE164(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, '');
  let normalized = stripped;
  if (stripped.startsWith('0') && stripped.length === 10) {
    normalized = `+254${stripped.slice(1)}`;
  } else if (stripped.startsWith('254') && stripped.length === 12) {
    normalized = `+${stripped}`;
  } else if (/^[17]\d{8}$/.test(stripped)) {
    normalized = `+254${stripped}`;
  }
  if (!KENYA_E164_REGEX.test(normalized)) {
    throw new Error(`Invalid Kenyan E.164 phone number: ${raw}`);
  }
  return normalized;
}

export function isValidKenyaE164(raw: string): boolean {
  try {
    normalizeKenyaPhoneToE164(raw);
    return true;
  } catch {
    return false;
  }
}

export function maskPhoneE164(phone: string): string {
  if (phone.length < 8) return '****';
  return `${phone.slice(0, 5)}***${phone.slice(-3)}`;
}
