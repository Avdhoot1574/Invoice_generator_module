// Client-side checks that mirror app/schemas/invoice_schema.py, so people see
// problems next to the field instead of waiting for a 422 from the server.
// The backend remains the authority; its errors are shown too.

import { parseDecimal } from "./decimal.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ReportLab reads text containing both < and > as markup (see para() in
// pdf_service.py), so these characters can break or restyle the PDF.
const MARKUP_MESSAGE =
  "Remove the < and > characters. The PDF generator treats them as formatting.";
const hasMarkup = (s) => s.includes("<") && s.includes(">");

function required(value, max, emptyMessage) {
  const v = value.trim();
  if (!v) return emptyMessage;
  if (v.length > max) return `Keep this under ${max} characters.`;
  return null;
}

function number(value, { label, maxDigits, maxDecimals, mustBePositive }) {
  const v = value.trim();
  if (!v) return `Enter ${label}.`;
  const parsed = parseDecimal(v);
  if (!parsed) return "Use digits and a decimal point only, like 1500.50.";
  if (parsed.scale > maxDecimals)
    return `Use at most ${maxDecimals} decimal place${maxDecimals === 1 ? "" : "s"}.`;
  const [whole] = v.split(".");
  const digits = whole.replace(/^0+/, "").length + parsed.scale;
  if (digits > maxDigits) return `That number is too long (max ${maxDigits} digits).`;
  if (mustBePositive && parsed.int === 0n) return "Must be greater than 0.";
  return null;
}

function optionalEmail(value) {
  const v = value.trim();
  if (!v) return null;
  return EMAIL_RE.test(v) ? null : "Enter a valid email address, or leave it blank.";
}

export function validateForm(form) {
  const errors = {};
  const set = (path, message) => {
    if (message) errors[path] = message;
  };

  // Invoice details
  set("invoice_number", required(form.invoice_number, 60, "Enter an invoice number."));
  set(
    "invoice_date",
    DATE_RE.test(form.invoice_date) ? null : "Choose the invoice date."
  );

  // Business
  const b = form.business;
  set("business.name", required(b.name, 120, "Enter your business name."));
  set("business.address", required(b.address, 500, "Enter your business address."));
  const bPhone = b.phone.trim();
  set(
    "business.phone",
    bPhone.length < 3 || bPhone.length > 30
      ? "Enter a phone number (3 to 30 characters)."
      : null
  );
  set("business.email", optionalEmail(b.email));
  if (b.gstin.trim().length > 20) set("business.gstin", "Keep the GSTIN under 20 characters.");

  // Customer
  const c = form.customer;
  set("customer.name", required(c.name, 120, "Enter the customer's name."));
  set("customer.address", required(c.address, 500, "Enter the customer's address."));
  const cPhone = c.phone.trim();
  set(
    "customer.phone",
    cPhone.length < 3 || cPhone.length > 30
      ? "Enter a phone number (3 to 30 characters)."
      : null
  );
  set("customer.email", optionalEmail(c.email));

  // Items
  form.items.forEach((item, i) => {
    const desc = required(item.description, 200, "Describe this item.");
    set(`items.${i}.description`, desc || (hasMarkup(item.description) ? MARKUP_MESSAGE : null));
    set(
      `items.${i}.quantity`,
      number(item.quantity, {
        label: "a quantity",
        maxDigits: 12,
        maxDecimals: 3,
        mustBePositive: true,
      })
    );
    set(
      `items.${i}.rate`,
      number(item.rate, { label: "a rate", maxDigits: 14, maxDecimals: 2, mustBePositive: false })
    );
  });

  // Payment and notes
  if (form.advance_paid.trim() !== "") {
    set(
      "advance_paid",
      number(form.advance_paid, {
        label: "an amount",
        maxDigits: 14,
        maxDecimals: 2,
        mustBePositive: false,
      })
    );
  }
  if (form.notes.trim().length > 1000) set("notes", "Keep notes under 1000 characters.");
  else if (hasMarkup(form.notes)) set("notes", MARKUP_MESSAGE);

  return errors;
}
