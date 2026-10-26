from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


MoneyInput = Decimal


class BusinessDetails(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    address: str = Field(..., min_length=1, max_length=500)
    phone: str = Field(..., min_length=3, max_length=30)
    email: Optional[EmailStr] = None
    gstin: Optional[str] = Field(default=None, max_length=20)


class CustomerDetails(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    address: str = Field(..., min_length=1, max_length=500)
    phone: str = Field(..., min_length=3, max_length=30)
    email: Optional[EmailStr] = None


class InvoiceItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    description: str = Field(..., min_length=1, max_length=200)
    quantity: Decimal = Field(..., gt=0, max_digits=12, decimal_places=3)
    rate: Decimal = Field(..., ge=0, max_digits=14, decimal_places=2)


class InvoiceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business: BusinessDetails
    customer: CustomerDetails
    items: List[InvoiceItem] = Field(..., min_length=1, max_length=100)
    advance_paid: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    invoice_number: str = Field(default="INV-DRAFT", min_length=1, max_length=60)
    invoice_date: date = Field(default_factory=date.today)
    notes: Optional[str] = Field(default=None, max_length=1000)
    currency: str = Field(default="Rs", pattern=r"^[A-Z]{3}$")

    @field_validator("invoice_number")
    @classmethod
    def validate_invoice_number(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Invoice number cannot be empty.")
        return value

    @model_validator(mode="after")
    def ensure_finite_values(self):
        if not self.advance_paid.is_finite():
            raise ValueError("Advance payment must be a finite number.")
        for item in self.items:
            if not item.quantity.is_finite() or not item.rate.is_finite():
                raise ValueError("Quantity and rate must be finite numbers.")
        return self


class InvoiceItemResult(BaseModel):
    description: str
    quantity: Decimal
    rate: Decimal
    amount: Decimal


class InvoicePreview(BaseModel):
    invoice_number: str
    invoice_date: date
    currency: str
    items: List[InvoiceItemResult]
    subtotal: Decimal
    advance_paid: Decimal
    balance_due: Decimal
    customer_credit: Decimal
