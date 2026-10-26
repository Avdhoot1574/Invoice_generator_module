import { centsFromString, formatCents } from "../lib/decimal.js";

function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "No date";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Prefer the server's numbers once it has confirmed them; otherwise show the
// exact local estimate.
function pickFigures(local, server, fallbackCurrency) {
  if (server) {
    return {
      currency: server.currency,
      subtotal: centsFromString(server.subtotal),
      advance: centsFromString(server.advance_paid),
      balanceDue: centsFromString(server.balance_due),
      credit: centsFromString(server.customer_credit),
    };
  }
  return {
    currency: fallbackCurrency,
    subtotal: local.subtotal,
    advance: local.advance,
    balanceDue: local.balanceDue,
    credit: local.credit,
  };
}

function Ledger({ label, value, strong }) {
  return (
    <div className={`ledger-row ${strong ? "strong" : ""}`}>
      <dt>{label}</dt>
      <span className="leader" aria-hidden="true" />
      <dd>{value}</dd>
    </div>
  );
}

export default function Summary({
  form,
  local,
  serverTotals,
  previewState,
  previewError,
  currencyLabel,
  pdf,
  onNewInvoice,
}) {
  const confirmed = previewState === "ok" && serverTotals;
  const f = pickFigures(local, confirmed ? serverTotals : null, currencyLabel);
  const money = (c) => formatCents(c, f.currency);
  const busy = pdf.status === "loading";

  let sourceNote;
  if (confirmed) sourceNote = "Totals confirmed by the invoice server.";
  else if (previewState === "loading") sourceNote = "Checking totals with the server…";
  else if (previewState === "error")
    sourceNote = `Server check failed: ${previewError} Showing the local estimate.`;
  else sourceNote = "Estimate. The server confirms totals once every required field is filled in.";

  return (
    <>
      <aside className="slip" aria-label="Invoice summary">
        <div className="slip-head">
          <p className="slip-number">{form.invoice_number.trim() || "No invoice number"}</p>
          <p className="slip-date">{formatDate(form.invoice_date)}</p>
        </div>

        <p className="slip-customer">
          <span>Bill to</span>
          {form.customer.name.trim() || "No customer yet"}
        </p>

        <dl className="ledger">
          <Ledger label="Subtotal" value={money(f.subtotal)} />
          <Ledger label="Advance paid" value={money(f.advance)} />
          {f.credit > 0n && <Ledger label="Credit to customer" value={money(f.credit)} />}
        </dl>

        <div className="balance">
          <span>Balance due</span>
          <strong>{money(f.balanceDue)}</strong>
        </div>

        <p className={`source-note ${previewState === "error" ? "is-error" : ""}`}>{sourceNote}</p>

        <button
          type="submit"
          form="invoice-form"
          className="button primary wide"
          disabled={busy}
        >
          {busy ? "Creating PDF…" : "Download PDF"}
        </button>

        <div aria-live="polite" className="pdf-message-wrap">
          {pdf.status === "done" && <p className="pdf-message ok">{pdf.message}</p>}
          {pdf.status === "error" && (
            <p className="pdf-message bad" role="alert">
              {pdf.message}
            </p>
          )}
        </div>

        <button type="button" className="button ghost wide" onClick={onNewInvoice}>
          Start a new invoice
        </button>
      </aside>

      <div className="mobile-bar">
        <div>
          <span>Balance due</span>
          <strong>{money(f.balanceDue)}</strong>
        </div>
        <button type="submit" form="invoice-form" className="button primary" disabled={busy}>
          {busy ? "Creating…" : "Download PDF"}
        </button>
      </div>
    </>
  );
}
