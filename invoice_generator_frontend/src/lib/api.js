// Thin client for the FastAPI backend.
//   GET  /                              health check
//   POST /api/invoices/preview          server-calculated totals (JSON)
//   POST /api/invoices/generate-pdf     PDF attachment

export const API_BASE = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// ---- Building the request body ------------------------------------------------
// The backend uses extra="forbid" and validates EmailStr, so empty optional
// fields must be left out entirely rather than sent as "".
const trim = (v) => (v ?? "").trim();
const optional = (v) => (trim(v) === "" ? undefined : trim(v));

export function buildPayload(form) {
  const { business: b, customer: c } = form;
  const payload = {
    business: {
      name: trim(b.name),
      address: trim(b.address),
      phone: trim(b.phone),
      email: optional(b.email),
      gstin: optional(b.gstin),
    },
    customer: {
      name: trim(c.name),
      address: trim(c.address),
      phone: trim(c.phone),
      email: optional(c.email),
    },
    items: form.items.map((item) => ({
      description: trim(item.description),
      quantity: trim(item.quantity),
      rate: trim(item.rate),
    })),
    advance_paid: optional(form.advance_paid) ?? "0",
    invoice_number: trim(form.invoice_number),
    invoice_date: form.invoice_date,
    notes: optional(form.notes),
  };
  // The server's own default is "Rs", but its validator only accepts three
  // capital letters, so "Rs" can never be sent. Omit the field to get the default.
  if (form.currency && form.currency !== "DEFAULT") payload.currency = form.currency;
  return payload;
}

// ---- Errors -------------------------------------------------------------------
async function readError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* not JSON */
  }
  const detail = body?.detail;

  if (typeof detail === "string") {
    return new ApiError(detail, { status: response.status });
  }

  if (Array.isArray(detail)) {
    const fieldErrors = {};
    const general = [];
    for (const entry of detail) {
      const path = (entry.loc || []).slice(1).join(".");
      const message = String(entry.msg || "Invalid value.").replace(/^Value error,\s*/i, "");
      if (path && !(path in fieldErrors)) fieldErrors[path] = message;
      else if (!path) general.push(message);
    }
    const message = general[0] || "The server rejected some fields. Check the highlighted entries.";
    return new ApiError(message, { status: response.status, fieldErrors });
  }

  return new ApiError(`The server returned an error (${response.status}).`, {
    status: response.status,
  });
}

async function request(path, init) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(
      `Can't reach the invoice server at ${API_BASE}. Start the backend with "uvicorn app.main:app --reload".`
    );
  }
  if (!response.ok) throw await readError(response);
  return response;
}

const jsonInit = (payload, signal) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
  signal,
});

// ---- Endpoints ----------------------------------------------------------------
export async function checkHealth(signal) {
  const response = await request("/", { signal });
  return response.json();
}

export async function previewInvoice(payload, signal) {
  const response = await request("/api/invoices/preview", jsonInit(payload, signal));
  return response.json();
}

// Mirrors safe_invoice_filename() in pdf_service.py. The browser can't read the
// server's Content-Disposition header across origins (CORS doesn't expose it),
// so the name is rebuilt here.
export function safeInvoiceFilename(invoiceNumber) {
  let cleaned = String(invoiceNumber)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
  cleaned = cleaned.slice(0, 60) || "invoice";
  return `invoice-${cleaned}.pdf`;
}

export async function generatePdf(payload) {
  const response = await request("/api/invoices/generate-pdf", jsonInit(payload));
  const blob = await response.blob();
  return { blob, filename: safeInvoiceFilename(payload.invoice_number) };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
