from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.invoice_schema import InvoiceCreate, InvoicePreview
from app.services.calculation_service import calculate_invoice
from app.services.pdf_service import generate_invoice_pdf, safe_invoice_filename

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


@router.post("/preview", response_model=InvoicePreview)
def preview_invoice(invoice: InvoiceCreate) -> InvoicePreview:
    """Validate invoice input and return server-calculated totals."""
    try:
        result = calculate_invoice(invoice)
        return InvoicePreview(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/generate-pdf", summary="Generate and download a PDF invoice")
def download_invoice_pdf(invoice: InvoiceCreate):
    """Generate the invoice in memory and return it as a downloadable PDF."""
    try:
        totals = calculate_invoice(invoice)
        pdf_bytes = generate_invoice_pdf(invoice, totals)
        filename = safe_invoice_filename(invoice.invoice_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Keep internal details out of the HTTP response.
        raise HTTPException(
            status_code=500,
            detail="The invoice PDF could not be generated. Check server logs.",
        ) from exc

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
