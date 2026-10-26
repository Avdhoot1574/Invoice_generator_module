// Exact decimal arithmetic with BigInt, so totals match the backend's Decimal
// maths (ROUND_HALF_UP to 2 places) with no floating-point drift.

const DECIMAL_RE = /^\d+(\.\d+)?$/;

export function parseDecimal(input) {
  const s = String(input ?? "").trim();
  if (!DECIMAL_RE.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return { int: BigInt(whole + frac), scale: frac.length };
}

const pow10 = (n) => 10n ** BigInt(n);

// Convert a scaled integer to cents, rounding half-up (values are non-negative).
function toCents(int, scale) {
  if (scale <= 2) return int * pow10(2 - scale);
  const divisor = pow10(scale - 2);
  return (int + divisor / 2n) / divisor;
}

export function centsFromString(input) {
  const p = parseDecimal(input);
  return p ? toCents(p.int, p.scale) : null;
}

// quantity x rate, rounded to cents. Returns null if either value is not a number.
export function lineCents(quantity, rate) {
  const q = parseDecimal(quantity);
  const r = parseDecimal(rate);
  if (!q || !r) return null;
  return toCents(q.int * r.int, q.scale + r.scale);
}

export function formatCents(cents, currency = "Rs") {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = (abs / 100n).toLocaleString("en-US");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${currency} ${negative ? "-" : ""}${whole}.${frac}`;
}

// Totals for the live summary. `complete` is false while any row is unfinished.
export function calcTotals(items, advancePaid) {
  let subtotal = 0n;
  let complete = true;

  const lines = items.map((item) => {
    const amount = lineCents(item.quantity, item.rate);
    if (amount === null) {
      complete = false;
      return null;
    }
    subtotal += amount;
    return amount;
  });

  const advanceText = String(advancePaid ?? "").trim();
  let advance = 0n;
  if (advanceText !== "") {
    const parsed = centsFromString(advanceText);
    if (parsed === null) complete = false;
    else advance = parsed;
  }

  const diff = subtotal - advance;
  return {
    lines,
    subtotal,
    advance,
    balanceDue: diff > 0n ? diff : 0n,
    credit: diff < 0n ? -diff : 0n,
    complete,
  };
}
