from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.invoice_routes import router as invoice_router

app = FastAPI(
    title="Invoice Generator API",
    description="Generate invoice previews and downloadable PDF invoices.",
    version="1.0.0",
    debug = True
)

# Adjust allowed origins when connecting your frontend in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(invoice_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "running", "application": "Invoice Generator"}
