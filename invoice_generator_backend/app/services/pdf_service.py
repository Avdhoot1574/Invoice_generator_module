import re
from io import BytesIO
from decimal import Decimal
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)

from app.schemas.invoice_schema import InvoiceCreate


def safe_invoice_filename(invoice_number: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", invoice_number).strip(".-_")
    cleaned = cleaned[:60] or "invoice"
    return f"invoice-{cleaned}.pdf"


def format_money(value: Decimal, currency: str) -> str:
    return f"{currency} {value:,.2f}"


# def para(value: object, style: ParagraphStyle) -> Paragraph:
#     return Paragraph(escape(str(value or "")).replace("\n", "<br/>"), style)

def para(value, style):
    """Render plain text and intentional ReportLab markup safely."""
    value = str(value if value is not None else "")

    # Preserve intentional ReportLab markup such as <b> and <br/>.
    # Escape ordinary text only when it contains no markup.
    if "<" in value and ">" in value:
        return Paragraph(value, style)

    value = escape(value).replace("\n", "<br/>")
    return Paragraph(value, style)


def generate_invoice_pdf(invoice: InvoiceCreate, totals: dict) -> bytes:
    """Create a print-ready A4 invoice PDF in memory."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author=invoice.business.name,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="BusinessTitle", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=18, leading=22, alignment=TA_LEFT, textColor=colors.HexColor("#172554"),
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="SectionHeading", parent=styles["Heading2"], fontSize=10,
        leading=13, textColor=colors.HexColor("#1F2937"), spaceBefore=7, spaceAfter=5,
    ))
    styles.add(ParagraphStyle(
        name="SmallText", parent=styles["BodyText"], fontSize=8.5, leading=11,
    ))
    styles.add(ParagraphStyle(
        name="RightText", parent=styles["BodyText"], alignment=TA_RIGHT,
        fontSize=9, leading=12,
    ))
    styles.add(ParagraphStyle(
        name="TableText", parent=styles["BodyText"], fontSize=8.5, leading=11,
    ))

    story = []
    story.append(para(invoice.business.name, styles["BusinessTitle"]))
    business_lines = [invoice.business.address, f"Phone: {invoice.business.phone}"]
    if invoice.business.email:
        business_lines.append(f"Email: {invoice.business.email}")
    if invoice.business.gstin:
        business_lines.append(f"GSTIN: {invoice.business.gstin}")
    story.append(para("\n".join(business_lines), styles["SmallText"]))
    story.append(Spacer(1, 8 * mm))

    header_data = [
        [para("INVOICE", styles["Heading1"]),
         para(f"<b>Invoice No:</b> {escape(invoice.invoice_number)}<br/><b>Date:</b> {invoice.invoice_date.isoformat()}",
              styles["RightText"])],
    ]
    header = Table(header_data, colWidths=[85 * mm, 85 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
    ]))
    story.append(header)
    story.append(Spacer(1, 5 * mm))

    customer_lines = [
        f"<b>Bill To</b>",
        escape(invoice.customer.name),
        escape(invoice.customer.address).replace("\n", "<br/>"),
        f"Phone: {escape(invoice.customer.phone)}",
    ]
    if invoice.customer.email:
        customer_lines.append(f"Email: {escape(str(invoice.customer.email))}")
    story.append(para("<br/>".join(customer_lines), styles["SmallText"]))
    story.append(Spacer(1, 6 * mm))

    table_data = [[
        para("<b>Description</b>", styles["TableText"]),
        para("<b>Qty</b>", styles["TableText"]),
        para("<b>Rate</b>", styles["TableText"]),
        para("<b>Amount</b>", styles["TableText"]),
    ]]
    for item in totals["items"]:
        table_data.append([
            para(item["description"], styles["TableText"]),
            para(str(item["quantity"]), styles["RightText"]),
            para(format_money(item["rate"], invoice.currency), styles["RightText"]),
            para(format_money(item["amount"], invoice.currency), styles["RightText"]),
        ])

    items_table = Table(table_data, colWidths=[84 * mm, 18 * mm, 34 * mm, 34 * mm], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 5 * mm))

    summary_data = [
        ["Subtotal", format_money(totals["subtotal"], invoice.currency)],
        ["Advance paid", format_money(totals["advance_paid"], invoice.currency)],
        ["Balance due", format_money(totals["balance_due"], invoice.currency)],
    ]
    if totals["customer_credit"] > 0:
        summary_data.append(["Customer credit / refund due", format_money(totals["customer_credit"], invoice.currency)])

    summary = Table(summary_data, colWidths=[55 * mm, 45 * mm], hAlign="RIGHT")
    summary.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor("#64748B")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(summary)

    if invoice.notes:
        story.append(Spacer(1, 8 * mm))
        story.append(para("Notes", styles["SectionHeading"]))
        story.append(para(invoice.notes, styles["SmallText"]))

    story.append(Spacer(1, 12 * mm))
    story.append(para("Thank you for your business.", styles["SmallText"]))

    doc.build(story)
    return buffer.getvalue()
