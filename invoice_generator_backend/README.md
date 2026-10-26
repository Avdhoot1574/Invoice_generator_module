# Invoice Generator Backend

A starter FastAPI backend that validates invoice input, calculates totals using `Decimal`, generates an A4 PDF with ReportLab, and returns it as a browser-downloadable file.

## Requirements

- Python 3.10+
- pip

## Setup (Windows PowerShell)

```powershell
cd invoice_generator_backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, use Command Prompt instead:

```bat
.venv\Scripts\activate.bat
```

## Run

From the project root:

```powershell
uvicorn app.main:app --reload
```

Open:
- Health check: http://127.0.0.1:8000/
- Swagger UI: http://127.0.0.1:8000/docs

## API endpoints

- `GET /` — health check
- `POST /api/invoices/preview` — return calculated totals as JSON
- `POST /api/invoices/generate-pdf` — return an invoice PDF attachment

## Example request

```json
{
  "business": {
    "name": "Example Co",
    "address": "Pune, Maharashtra",
    "phone": "9876543210",
    "email": "business@example.com"
  },
  "customer": {
    "name": "Rahul Sharma",
    "address": "Mumbai, Maharashtra",
    "phone": "9123456780",
    "email": "rahul@example.com"
  },
  "items": [
    {
      "description": "Website development",
      "quantity": "1",
      "rate": "15000.00"
    },
    {
      "description": "Domain and hosting",
      "quantity": "1",
      "rate": "2000.00"
    }
  ],
  "advance_paid": "5000.00",
  "invoice_number": "INV-2026-001",
  "notes": "Thank you for your business."
}
```

Use the request body in Swagger UI. The PDF endpoint returns `application/pdf` with a `Content-Disposition: attachment` header, so an HTTP client or frontend can save it as a file.

## Run tests

```powershell
pytest -q
```

## Important scope notes

- This version does not persist invoices or business/customer records.
- It is a basic invoice generator, not a GST-compliance implementation.
- For production, replace permissive CORS settings with the actual frontend origin, add request limits and logging, and review invoice numbering and applicable tax rules.
- A browser frontend should use `fetch()` to POST JSON, read the response as a `Blob`, create a temporary object URL, and trigger a download.
