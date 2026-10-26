# Invoice Generator Frontend

React (Vite) interface for the FastAPI `invoice_generator_backend`.

## Run it

You need Node 18 or newer. Start the backend first, then this app.

```powershell
# Terminal 1: backend (from invoice_generator_backend)
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload

# Terminal 2: frontend (from invoice_generator_frontend)
npm install
npm run dev
```

Open http://localhost:5173. The status pill in the top bar shows whether the
backend is reachable. If the backend runs somewhere else, copy `.env.example`
to `.env` and change `VITE_API_BASE_URL`.

## What it does

| Screen action | Backend call |
| --- | --- |
| Page loads / status pill | `GET /` |
| Form is complete and you pause typing | `POST /api/invoices/preview` (totals shown in the summary are the server's) |
| Download PDF | `POST /api/invoices/generate-pdf` (saved as `invoice-<number>.pdf`) |

- Totals update instantly as you type, using exact decimal maths that matches
  the backend (half-up rounding, no floating-point drift). Once the form is
  valid, the server's figures replace the local estimate.
- Field checks mirror `invoice_schema.py` (lengths, quantity > 0, 3 / 2 decimal
  places, digit limits), and any 422 from the server is shown next to the field.
- Business details and currency are remembered in the browser (localStorage).
  "Start a new invoice" keeps them and bumps the invoice number.

## Things worth knowing about the backend

1. **Currency.** The backend's default is `"Rs"`, but its validator only allows
   three capital letters, so `"Rs"` can never be sent back. The
   "Rs (server default)" option therefore omits the field. Other choices send
   `INR`, `USD`, etc., and the PDF prints that code before each amount.
2. **`<` and `>` in item descriptions or notes.** `pdf_service.para()` treats
   text containing both characters as ReportLab markup, so malformed input can
   fail PDF generation. The form blocks these characters with a message. The
   cleaner fix is in the backend: always `escape()` description and notes.
3. **CORS.** `allow_origins=["*"]` works for development. For production, set it
   to your frontend's origin. The browser can't read `Content-Disposition`
   unless you add `expose_headers=["Content-Disposition"]`, so the frontend
   builds the filename itself using the same rule as `safe_invoice_filename`.

## Project layout

```
src/
  App.jsx                  state, validation display, preview + download flow
  components/              Field, ItemsEditor, Summary, ServerStatus
  lib/api.js               fetch client, payload builder, error parsing
  lib/decimal.js           exact BigInt money maths
  lib/validation.js        client-side rules mirroring the Pydantic schema
  lib/invoiceNumber.js     INV-2026-009 -> INV-2026-010
  lib/logic.test.js        run with: npm run test:logic
  styles.css
```

## Build for production

```powershell
npm run build   # outputs dist/
```
