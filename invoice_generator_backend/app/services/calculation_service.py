from decimal import Decimal, ROUND_HALF_UP

from app.schemas.invoice_schema import InvoiceCreate

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    """Round a monetary amount to two decimal places using half-up rounding."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_invoice(invoice: InvoiceCreate) -> dict:
    """Calculate all authoritative invoice amounts on the server."""
    item_results = []
    subtotal = Decimal("0.00")

    for item in invoice.items:
        line_total = money(item.quantity * item.rate)
        subtotal += line_total
        item_results.append(
            {
                "description": item.description,
                "quantity": item.quantity,
                "rate": money(item.rate),
                "amount": line_total,
            }
        )

    subtotal = money(subtotal)
    advance = money(invoice.advance_paid)
    balance_due = max(Decimal("0.00"), money(subtotal - advance))
    customer_credit = max(Decimal("0.00"), money(advance - subtotal))

    return {
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date,
        "currency": invoice.currency,
        "items": item_results,
        "subtotal": subtotal,
        "advance_paid": advance,
        "balance_due": balance_due,
        "customer_credit": customer_credit,
    }
