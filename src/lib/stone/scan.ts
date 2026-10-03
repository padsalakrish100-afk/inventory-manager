// A scanned code can be a bare stone number (Code128 labels, typing) or the
// URL encoded in a QR label (".../s/LOT-2026-001-0001"). Both resolve to the
// same stone number.
export function parseScannedCode(raw: string): string {
  const value = raw.trim();
  const marker = value.lastIndexOf("/s/");
  if (marker === -1) return value;
  const tail = value.slice(marker + 3).split(/[?#]/)[0];
  try {
    return decodeURIComponent(tail).trim();
  } catch {
    return tail.trim();
  }
}
