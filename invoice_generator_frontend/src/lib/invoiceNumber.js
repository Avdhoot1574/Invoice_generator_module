// "INV-2026-009" -> "INV-2026-010". Keeps zero-padding. Falls back to
// appending "-2" when the number has no digits at the end.
export function nextInvoiceNumber(current) {
  const match = /^(.*?)(\d+)(\D*)$/.exec(current.trim());
  if (!match) return current.trim() ? `${current.trim()}-2` : "INV-001";
  const [, prefix, digits, suffix] = match;
  const next = (BigInt(digits) + 1n).toString().padStart(digits.length, "0");
  return `${prefix}${next}${suffix}`;
}
