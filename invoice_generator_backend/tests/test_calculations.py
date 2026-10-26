from decimal import Decimal

from app.schemas.invoice_schema import InvoiceCreate
from app.services.calculation_service import calculate_invoice


def sample_invoice(**overrides):
    data = {
        "business": {"name": "Example Co", "address": "Pune", "phone": "1234567890"},
        "customer": {"name": "Customer", "address": "Mumbai", "phone": "0987654321"},
        "items": [
            {"description": "Service", "quantity": "1", "rate": "15000.00"},
            {"description": "Hosting", "quantity": "1", "rate": "2000.00"},
        ],
        "advance_paid": "5000.00",
        "invoice_number": "INV-001",
    }
    data.update(overrides)
    return InvoiceCreate(**data)


def test_calculates_subtotal_and_balance():
    result = calculate_invoice(sample_invoice())
    assert result["subtotal"] == Decimal("17000.00")
    assert result["advance_paid"] == Decimal("5000.00")
    assert result["balance_due"] == Decimal("12000.00")
    assert result["customer_credit"] == Decimal("0.00")


def test_advance_over_total_becomes_credit():
    result = calculate_invoice(sample_invoice(advance_paid="20000.00"))
    assert result["balance_due"] == Decimal("0.00")
    assert result["customer_credit"] == Decimal("3000.00")


def test_decimal_quantity_and_rounding():
    invoice = sample_invoice(
        items=[{"description": "Weight", "quantity": "1.5", "rate": "10.10"}],
        advance_paid="0",
    )
    result = calculate_invoice(invoice)
    assert result["subtotal"] == Decimal("15.15")
