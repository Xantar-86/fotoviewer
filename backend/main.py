from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import io, base64, json
from database import get_db, init_db, Income, Order
from image_processing import (
    strip_exif, auto_enhance, add_text_watermark, add_logo_watermark,
    blur_area, resize_for_platform, detect_faces, crop_image, PLATFORM_PRESETS
)
from ai_service import (
    analyze_photo, generate_titles, generate_session_ideas, generate_reply_templates
)

app = FastAPI(title="FeetBusiness Studio API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Image processing routes
# ---------------------------------------------------------------------------

@app.post("/api/images/strip-exif")
async def api_strip_exif(file: UploadFile = File(...)):
    data = await file.read()
    result = strip_exif(data)
    return StreamingResponse(
        io.BytesIO(result),
        media_type="image/jpeg",
        headers={"Content-Disposition": f"attachment; filename=cleaned_{file.filename}"},
    )


@app.post("/api/images/enhance")
async def api_enhance(
    file: UploadFile = File(...),
    brightness: float = Form(1.0),
    contrast: float = Form(1.0),
    color: float = Form(1.0),
    sharpness: float = Form(1.0),
):
    data = await file.read()
    result = auto_enhance(data, brightness, contrast, color, sharpness)
    encoded = base64.b64encode(result).decode()
    return {"image": encoded, "filename": file.filename}


@app.post("/api/images/watermark-text")
async def api_watermark_text(
    file: UploadFile = File(...),
    text: str = Form("© FeetBusiness"),
    position: str = Form("bottom-right"),
    opacity: int = Form(180),
    font_size: int = Form(36),
    color: str = Form("#ffffff"),
):
    data = await file.read()
    result = add_text_watermark(data, text, position, opacity, font_size, color)
    encoded = base64.b64encode(result).decode()
    return {"image": encoded}


@app.post("/api/images/watermark-logo")
async def api_watermark_logo(
    file: UploadFile = File(...),
    logo: UploadFile = File(...),
    position: str = Form("bottom-right"),
    opacity: int = Form(180),
    scale: float = Form(0.15),
):
    data = await file.read()
    logo_data = await logo.read()
    result = add_logo_watermark(data, logo_data, position, opacity, scale)
    encoded = base64.b64encode(result).decode()
    return {"image": encoded}


@app.post("/api/images/resize")
async def api_resize(
    file: UploadFile = File(...),
    platform: str = Form("FeetFinder"),
):
    data = await file.read()
    preset = PLATFORM_PRESETS.get(platform)
    if not preset:
        raise HTTPException(400, f"Onbekend platform: {platform}")
    result = resize_for_platform(data, preset["w"], preset["h"], preset["mode"])
    encoded = base64.b64encode(result).decode()
    return {"image": encoded, "width": preset["w"], "height": preset["h"]}


@app.post("/api/images/crop")
async def api_crop(
    file: UploadFile = File(...),
    top: int = Form(0),
    right: int = Form(0),
    bottom: int = Form(0),
    left: int = Form(0),
):
    data = await file.read()
    result = crop_image(data, top, right, bottom, left)
    encoded = base64.b64encode(result).decode()
    return {"image": encoded}


@app.post("/api/images/blur")
async def api_blur(
    file: UploadFile = File(...),
    x: int = Form(0),
    y: int = Form(0),
    width: int = Form(100),
    height: int = Form(100),
    strength: int = Form(15),
):
    data = await file.read()
    result = blur_area(data, x, y, width, height, strength)
    encoded = base64.b64encode(result).decode()
    return {"image": encoded}


@app.post("/api/images/detect-faces")
async def api_detect_faces(file: UploadFile = File(...)):
    data = await file.read()
    faces = detect_faces(data)
    return {"faces": faces, "count": len(faces)}


@app.get("/api/images/platforms")
def api_platforms():
    return {"platforms": list(PLATFORM_PRESETS.keys()), "presets": PLATFORM_PRESETS}


@app.post("/api/images/process")
async def api_process_full(
    file: UploadFile = File(...),
    options: str = Form("{}"),
):
    """Full processing pipeline — apply multiple operations at once."""
    data = await file.read()
    opts = json.loads(options)

    if opts.get("strip_exif", True):
        data = strip_exif(data)

    if opts.get("enhance"):
        e = opts["enhance"]
        data = auto_enhance(
            data,
            e.get("brightness", 1.0),
            e.get("contrast", 1.0),
            e.get("color", 1.0),
            e.get("sharpness", 1.0),
        )

    if opts.get("crop"):
        c = opts["crop"]
        data = crop_image(
            data,
            c.get("top", 0),
            c.get("right", 0),
            c.get("bottom", 0),
            c.get("left", 0),
        )

    if opts.get("watermark_text"):
        w = opts["watermark_text"]
        data = add_text_watermark(
            data,
            w.get("text", ""),
            w.get("position", "bottom-right"),
            w.get("opacity", 180),
            w.get("font_size", 36),
            w.get("color", "#ffffff"),
        )

    if opts.get("platform"):
        preset = PLATFORM_PRESETS.get(opts["platform"])
        if preset:
            data = resize_for_platform(data, preset["w"], preset["h"], preset["mode"])

    encoded = base64.b64encode(data).decode()
    return {"image": encoded, "size": len(data)}


# ---------------------------------------------------------------------------
# AI routes
# ---------------------------------------------------------------------------

class SessionIdeasRequest(BaseModel):
    api_key: str
    platform: str = "FeetFinder"
    theme: str = "elegant"


class ReplyTemplateRequest(BaseModel):
    api_key: str
    scenario: str = "Prijsvraag"


@app.post("/api/ai/analyze")
async def api_analyze(
    file: UploadFile = File(...),
    api_key: str = Form(...),
):
    data = await file.read()
    try:
        result = await analyze_photo(data, api_key)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/ai/titles")
async def api_titles(
    file: UploadFile = File(...),
    api_key: str = Form(...),
):
    data = await file.read()
    try:
        result = await generate_titles(data, api_key)
        return {"titles": result}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/ai/session-ideas")
async def api_session_ideas(request: SessionIdeasRequest):
    try:
        result = await generate_session_ideas(request.platform, request.theme, request.api_key)
        return {"ideas": result}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/ai/reply-templates")
async def api_reply_templates(request: ReplyTemplateRequest):
    try:
        result = await generate_reply_templates(request.scenario, request.api_key)
        return {"templates": result}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Business routes
# ---------------------------------------------------------------------------

class IncomeCreate(BaseModel):
    platform: str
    datum: str
    bedrag: float
    beschrijving: str = ""


class OrderCreate(BaseModel):
    klant: str
    platform: str
    beschrijving: str = ""
    prijs: float
    datum: str
    status: str = "Nieuw"


class PriceCalcRequest(BaseModel):
    base_price: float
    quantity: int
    discount_percent: float = 0.0


@app.get("/api/business/income")
def get_income(platform: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Income)
    if platform:
        query = query.filter(Income.platform == platform)
    items = query.order_by(Income.datum.desc()).all()
    return {
        "items": [
            {
                "id": i.id,
                "platform": i.platform,
                "datum": i.datum,
                "bedrag": i.bedrag,
                "beschrijving": i.beschrijving,
            }
            for i in items
        ],
        "total": sum(i.bedrag for i in items),
    }


@app.post("/api/business/income")
def add_income(data: IncomeCreate, db: Session = Depends(get_db)):
    item = Income(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "message": "Inkomen toegevoegd"}


@app.delete("/api/business/income/{item_id}")
def delete_income(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Income).filter(Income.id == item_id).first()
    if not item:
        raise HTTPException(404, "Niet gevonden")
    db.delete(item)
    db.commit()
    return {"message": "Verwijderd"}


@app.get("/api/business/income/stats")
def income_stats(db: Session = Depends(get_db)):
    items = db.query(Income).all()
    by_platform: dict = {}
    for i in items:
        by_platform[i.platform] = by_platform.get(i.platform, 0) + i.bedrag
    return {
        "total": sum(i.bedrag for i in items),
        "count": len(items),
        "by_platform": by_platform,
    }


@app.get("/api/business/orders")
def get_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    items = query.order_by(Order.datum.desc()).all()
    return {
        "items": [
            {
                "id": i.id,
                "klant": i.klant,
                "platform": i.platform,
                "beschrijving": i.beschrijving,
                "prijs": i.prijs,
                "status": i.status,
                "datum": i.datum,
            }
            for i in items
        ]
    }


@app.post("/api/business/orders")
def add_order(data: OrderCreate, db: Session = Depends(get_db)):
    item = Order(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "message": "Bestelling toegevoegd"}


@app.put("/api/business/orders/{order_id}")
def update_order(order_id: int, status: str, db: Session = Depends(get_db)):
    item = db.query(Order).filter(Order.id == order_id).first()
    if not item:
        raise HTTPException(404, "Niet gevonden")
    item.status = status
    db.commit()
    return {"message": "Status bijgewerkt"}


@app.delete("/api/business/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    item = db.query(Order).filter(Order.id == order_id).first()
    if not item:
        raise HTTPException(404, "Niet gevonden")
    db.delete(item)
    db.commit()
    return {"message": "Verwijderd"}


@app.post("/api/business/calculate-price")
def calculate_price(request: PriceCalcRequest):
    subtotal = request.base_price * request.quantity
    discount = subtotal * (request.discount_percent / 100)
    total = subtotal - discount
    return {
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "total": round(total, 2),
        "per_item": round(total / request.quantity, 2) if request.quantity > 0 else 0,
    }
