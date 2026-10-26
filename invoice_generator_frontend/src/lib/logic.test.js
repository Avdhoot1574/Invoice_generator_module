import test from "node:test";
import assert from "node:assert/strict";

import { lineCents, centsFromString, formatCents, calcTotals } from "./decimal.js";
import { validateForm } from "./validation.js";
import { buildPayload, safeInvoiceFilename } from "./api.js";
import { nextInvoiceNumber } from "./invoiceNumber.js";

const item = (quantity, rate, description = "x") => ({ id: 1, description, quantity, rate });

// ---- mirrors tests/test_calculations.py -------------------------------------
test("subtotal and balance match the backend example", () => {
  const t = calcTotals([item("1", "15000.00"), item("1", "2000.00")], "5000.00");
  assert.equal(t.subtotal, 1700000n);
  assert.equal(t.balanceDue, 1200000n);
  assert.equal(t.credit, 0n);
  assert.ok(t.complete);
});

test("advance above total becomes customer credit", () => {
  const t = calcTotals([item("1", "15000.00"), item("1", "2000.00")], "20000.00");
  assert.equal(t.balanceDue, 0n);
  assert.equal(t.credit, 300000n);
});

test("decimal quantity: 1.5 x 10.10 = 15.15", () => {
  assert.equal(lineCents("1.5", "10.10"), 1515n);
});

test("rounds half up like Decimal ROUND_HALF_UP", () => {
  assert.equal(lineCents("0.005", "1"), 1n); // 0.005 -> 0.01
  assert.equal(lineCents("0.004", "1"), 0n);
  assert.equal(lineCents("1.333", "3"), 400n); // 3.999 -> 4.00
  assert.equal(lineCents("2.675", "1"), 268n); // float maths would give 2.67
});

test("no float drift on classic 0.1 + 0.2 style sums", () => {
  const t = calcTotals([item("1", "0.10"), item("1", "0.20")], "");
  assert.equal(t.subtotal, 30n);
});

test("incomplete rows flag the totals as incomplete", () => {
  assert.equal(calcTotals([item("", "")], "").complete, false);
  assert.equal(calcTotals([item("1", "5")], "abc").complete, false);
});

test("formatting matches backend format_money", () => {
  assert.equal(formatCents(1700000n, "Rs"), "Rs 17,000.00");
  assert.equal(formatCents(5n, "INR"), "INR 0.05");
  assert.equal(centsFromString("17000.00"), 1700000n);
});

// ---- validation -------------------------------------------------------------
const validForm = () => ({
  business: { name: "Example Co", address: "Pune", phone: "9876543210", email: "", gstin: "" },
  customer: { name: "Rahul", address: "Mumbai", phone: "9123456780", email: "" },
  items: [item("1", "15000.00", "Website development")],
  advance_paid: "",
  invoice_number: "INV-2026-001",
  invoice_date: "2026-10-26",
  notes: "",
  currency: "DEFAULT",
});

test("a complete form has no errors", () => {
  assert.deepEqual(validateForm(validForm()), {});
});

test("rejects zero quantity (backend test_rejects_zero_quantity)", () => {
  const f = validForm();
  f.items[0].quantity = "0";
  assert.ok(validateForm(f)["items.0.quantity"]);
});

test("rejects too many decimals, negatives, and text", () => {
  const f = validForm();
  f.items[0].quantity = "1.2345";
  f.items[0].rate = "10.999";
  f.advance_paid = "-5";
  const e = validateForm(f);
  assert.ok(e["items.0.quantity"]);
  assert.ok(e["items.0.rate"]);
  assert.ok(e["advance_paid"]);
});

test("allows zero rate (backend: rate ge 0) and blank advance", () => {
  const f = validForm();
  f.items[0].rate = "0";
  assert.deepEqual(validateForm(f), {});
});

test("flags < and > in description and notes (ReportLab markup)", () => {
  const f = validForm();
  f.items[0].description = "a <b>bold</b> item";
  f.notes = "x < y > z";
  const e = validateForm(f);
  assert.ok(e["items.0.description"]);
  assert.ok(e["notes"]);
});

test("optional email must be valid when present", () => {
  const f = validForm();
  f.customer.email = "not-an-email";
  assert.ok(validateForm(f)["customer.email"]);
});

// ---- payload ----------------------------------------------------------------
test("payload omits empty optionals and the default currency", () => {
  const p = buildPayload(validForm());
  assert.equal("email" in JSON.parse(JSON.stringify(p.business)), false);
  assert.equal("gstin" in JSON.parse(JSON.stringify(p.business)), false);
  assert.equal("notes" in JSON.parse(JSON.stringify(p)), false);
  assert.equal("currency" in p, false); // "Rs" would fail the ^[A-Z]{3}$ pattern
  assert.equal(p.advance_paid, "0");
  assert.equal(p.items[0].quantity, "1");
});

test("payload sends a 3-letter currency when chosen", () => {
  const f = validForm();
  f.currency = "INR";
  assert.equal(buildPayload(f).currency, "INR");
});

test("payload only contains keys the backend allows (extra=forbid)", () => {
  const p = JSON.parse(JSON.stringify(buildPayload({ ...validForm(), currency: "USD" })));
  assert.deepEqual(
    Object.keys(p).sort(),
    ["advance_paid", "business", "currency", "customer", "invoice_date", "invoice_number", "items"].sort()
  );
  assert.deepEqual(Object.keys(p.items[0]).sort(), ["description", "quantity", "rate"]);
});

// ---- filenames / numbering --------------------------------------------------
test("filename matches safe_invoice_filename", () => {
  assert.equal(safeInvoiceFilename("INV-2026-001"), "invoice-INV-2026-001.pdf");
  assert.equal(safeInvoiceFilename("A/B C"), "invoice-A-B-C.pdf");
  assert.equal(safeInvoiceFilename("///"), "invoice-invoice.pdf");
});

test("next invoice number keeps padding", () => {
  assert.equal(nextInvoiceNumber("INV-2026-001"), "INV-2026-002");
  assert.equal(nextInvoiceNumber("INV-2026-009"), "INV-2026-010");
  assert.equal(nextInvoiceNumber("INV-099"), "INV-100");
  assert.equal(nextInvoiceNumber("ABC"), "ABC-2");
});
