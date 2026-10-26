import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Field from "./components/Field.jsx";
import ItemsEditor from "./components/ItemsEditor.jsx";
import ServerStatus from "./components/ServerStatus.jsx";
import Summary from "./components/Summary.jsx";

import {
  buildPayload,
  checkHealth,
  downloadBlob,
  generatePdf,
  previewInvoice,
} from "./lib/api.js";
import { calcTotals } from "./lib/decimal.js";
import { nextInvoiceNumber } from "./lib/invoiceNumber.js";
import { validateForm } from "./lib/validation.js";

// ---- Static data ----------------------------------------------------------------
// "DEFAULT" means: leave `currency` out and let the server use its own default (Rs).
const CURRENCIES = [
  { value: "DEFAULT", label: "Rs (server default)", prefix: "Rs" },
  { value: "INR", label: "INR – Indian rupee", prefix: "INR" },
  { value: "USD", label: "USD – US dollar", prefix: "USD" },
  { value: "EUR", label: "EUR – Euro", prefix: "EUR" },
  { value: "GBP", label: "GBP – Pound sterling", prefix: "GBP" },
  { value: "AED", label: "AED – UAE dirham", prefix: "AED" },
  { value: "SGD", label: "SGD – Singapore dollar", prefix: "SGD" },
  { value: "AUD", label: "AUD – Australian dollar", prefix: "AUD" },
  { value: "CAD", label: "CAD – Canadian dollar", prefix: "CAD" },
];

const PREFS_KEY = "invoiceGenerator.prefs.v1";
const PREVIEW_DELAY_MS = 450;

// ---- Helpers --------------------------------------------------------------------
let rowCounter = 0;
const newItem = () => ({ id: ++rowCounter, description: "", quantity: "1", rate: "" });

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyBusiness = { name: "", address: "", phone: "", email: "", gstin: "" };

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode, quota) – safe to ignore */
  }
}

function initialForm() {
  const prefs = loadPrefs();
  return {
    business: { ...emptyBusiness, ...(prefs?.business || {}) },
    customer: { name: "", address: "", phone: "", email: "" },
    items: [newItem()],
    advance_paid: "",
    invoice_number: `INV-${new Date().getFullYear()}-001`,
    invoice_date: todayISO(),
    notes: "",
    currency: prefs?.currency || "DEFAULT",
  };
}

// Immutable update for paths like "business.name" or "items.2.rate".
function setIn(obj, keys, value) {
  const [key, ...rest] = keys;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[key] = rest.length ? setIn(obj[key], rest, value) : value;
  return copy;
}

const getIn = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

function useServerHealth() {
  const [state, setState] = useState("checking");
  const check = useCallback(async () => {
    try {
      await checkHealth();
      setState("up");
    } catch {
      setState("down");
    }
  }, []);
  useEffect(() => {
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, [check]);
  return [state, check];
}

// ---- App ------------------------------------------------------------------------
export default function App() {
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const [serverTotals, setServerTotals] = useState(null);
  const [previewState, setPreviewState] = useState("idle"); // idle | loading | ok | error
  const [previewError, setPreviewError] = useState("");

  const [pdf, setPdf] = useState({ status: "idle", message: "" });
  const [health, recheckHealth] = useServerHealth();
  const formRef = useRef(null);

  const errors = useMemo(() => validateForm(form), [form]);
  const isValid = Object.keys(errors).length === 0;
  const local = useMemo(() => calcTotals(form.items, form.advance_paid), [form.items, form.advance_paid]);
  const currencyLabel = CURRENCIES.find((c) => c.value === form.currency)?.prefix ?? "Rs";

  // Remember business details and currency in this browser (the backend stores nothing).
  useEffect(() => {
    savePrefs({ business: form.business, currency: form.currency });
  }, [form.business, form.currency]);

  // Ask the server to confirm totals once the form is valid.
  useEffect(() => {
    if (!isValid) {
      setServerTotals(null);
      setPreviewState("idle");
      return undefined;
    }
    const controller = new AbortController();
    setPreviewState("loading");
    const timer = setTimeout(async () => {
      try {
        const data = await previewInvoice(buildPayload(form), controller.signal);
        setServerTotals(data);
        setPreviewState("ok");
      } catch (err) {
        if (err?.name === "AbortError") return;
        setServerTotals(null);
        setPreviewError(err.message);
        setPreviewState("error");
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form, isValid]);

  // ---- Field wiring -------------------------------------------------------------
  const update = useCallback((path, value) => {
    setForm((f) => setIn(f, path.split("."), value));
    setServerErrors({});
    setPdf((p) => (p.status === "idle" ? p : { status: "idle", message: "" }));
  }, []);

  const field = (path) => {
    const showLocal = submitted || touched[path];
    return {
      id: `f-${path.replace(/\./g, "-")}`,
      name: path,
      value: getIn(form, path) ?? "",
      onChange: (e) => update(path, e.target.value),
      onBlur: () => setTouched((t) => (t[path] ? t : { ...t, [path]: true })),
      error: (showLocal && errors[path]) || serverErrors[path] || undefined,
    };
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, newItem()] }));

  const removeItem = (id) => {
    setForm((f) => (f.items.length > 1 ? { ...f, items: f.items.filter((i) => i.id !== id) } : f));
    // Row indexes shift after a removal, so per-row touched/server state is stale.
    setTouched((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith("items."))));
    setServerErrors({});
  };

  // ---- Actions ------------------------------------------------------------------
  const smooth = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const focusFirstError = () => {
    setTimeout(() => {
      const el = formRef.current?.querySelector('[aria-invalid="true"]');
      if (el) {
        el.scrollIntoView({ block: "center", behavior: smooth() });
        el.focus({ preventScroll: true });
      }
    }, 0);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pdf.status === "loading") return;
    setSubmitted(true);

    if (!isValid) {
      setPdf({ status: "error", message: "Fix the highlighted fields, then download again." });
      focusFirstError();
      return;
    }

    setPdf({ status: "loading", message: "" });
    try {
      const { blob, filename } = await generatePdf(buildPayload(form));
      downloadBlob(blob, filename);
      setPdf({ status: "done", message: `Downloaded ${filename}` });
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setServerErrors(err.fieldErrors);
        focusFirstError();
      }
      setPdf({ status: "error", message: err.message });
    }
  };

  const startNewInvoice = () => {
    const hasWork =
      form.customer.name.trim() || form.items.some((i) => i.description.trim() || i.rate.trim());
    if (hasWork && !window.confirm("Start a new invoice? The customer and items on this one will be cleared.")) {
      return;
    }
    setForm((f) => ({
      ...initialForm(),
      business: f.business,
      currency: f.currency,
      invoice_number: nextInvoiceNumber(f.invoice_number),
    }));
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setPdf({ status: "idle", message: "" });
    window.scrollTo({ top: 0, behavior: smooth() });
  };

  // ---- Render -------------------------------------------------------------------
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Invoice Generator</span>
        <ServerStatus state={health} onRetry={recheckHealth} />
      </header>

      {health === "down" && (
        <div className="banner" role="alert">
          The invoice server isn't responding. Start it from the backend folder with{" "}
          <code>uvicorn app.main:app --reload</code>, then select the status button above to check again.
        </div>
      )}

      <main className="layout">
        <form id="invoice-form" ref={formRef} className="sheet" onSubmit={handleSubmit} noValidate>
          <h1>New invoice</h1>

          <section aria-labelledby="sec-details">
            <h2 id="sec-details">Invoice details</h2>
            <div className="grid three">
              <Field label="Invoice number" autoComplete="off" {...field("invoice_number")} />
              <Field label="Date" type="date" {...field("invoice_date")} />
              <Field
                label="Currency"
                as="select"
                hint="Printed before every amount on the PDF."
                {...field("currency")}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Field>
            </div>
          </section>

          <section aria-labelledby="sec-from">
            <h2 id="sec-from">From</h2>
            <p className="section-note">Saved in this browser, so you only enter it once.</p>
            <div className="grid two">
              <Field label="Business name" autoComplete="organization" {...field("business.name")} />
              <Field label="Phone" type="tel" autoComplete="tel" {...field("business.phone")} />
              <Field
                label="Address"
                as="textarea"
                rows={3}
                className="span-2"
                autoComplete="street-address"
                {...field("business.address")}
              />
              <Field
                label="Email"
                type="email"
                optional
                autoComplete="email"
                {...field("business.email")}
              />
              <Field label="GSTIN" optional autoComplete="off" {...field("business.gstin")} />
            </div>
          </section>

          <section aria-labelledby="sec-to">
            <h2 id="sec-to">Bill to</h2>
            <div className="grid two">
              <Field label="Customer name" autoComplete="off" {...field("customer.name")} />
              <Field label="Phone" type="tel" autoComplete="off" {...field("customer.phone")} />
              <Field
                label="Address"
                as="textarea"
                rows={3}
                className="span-2"
                autoComplete="off"
                {...field("customer.address")}
              />
              <Field label="Email" type="email" optional autoComplete="off" {...field("customer.email")} />
            </div>
          </section>

          <section aria-labelledby="sec-items">
            <h2 id="sec-items">Items</h2>
            <ItemsEditor
              items={form.items}
              lineAmounts={local.lines}
              currencyLabel={currencyLabel}
              field={field}
              onAdd={addItem}
              onRemove={removeItem}
            />
          </section>

          <section aria-labelledby="sec-payment">
            <h2 id="sec-payment">Payment and notes</h2>
            <div className="grid two">
              <Field
                label="Advance paid"
                inputMode="decimal"
                optional
                placeholder="0.00"
                hint="Deducted from the subtotal. Anything above the total is shown as credit."
                autoComplete="off"
                {...field("advance_paid")}
              />
              <Field
                label="Notes"
                as="textarea"
                rows={3}
                optional
                placeholder="Payment terms, bank details, thank-you message"
                {...field("notes")}
              />
            </div>
          </section>
        </form>

        <Summary
          form={form}
          local={local}
          serverTotals={serverTotals}
          previewState={previewState}
          previewError={previewError}
          currencyLabel={currencyLabel}
          pdf={pdf}
          onNewInvoice={startNewInvoice}
        />
      </main>
    </div>
  );
}
