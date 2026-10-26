from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def valid_payload():
    return {
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
            {"description": "Website development", "quantity": "1", "rate": "15000.00"},
            {"description": "Domain and hosting", "quantity": "1", "rate": "2000.00"}
        ],
        "advance_paid": "5000.00",
        "invoice_number": "INV-2026-001",
        "notes": "Thank you for your business."
    }


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_preview_totals():
    response = client.post("/api/invoices/preview", json=valid_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["subtotal"] == "17000.00"
    assert data["balance_due"] == "12000.00"


def test_pdf_download():
    response = client.post("/api/invoices/generate-pdf", json=valid_payload())
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert 'attachment; filename="invoice-INV-2026-001.pdf"' in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_rejects_zero_quantity():
    payload = valid_payload()
    payload["items"][0]["quantity"] = "0"
    response = client.post("/api/invoices/preview", json=payload)
    assert response.status_code == 422
