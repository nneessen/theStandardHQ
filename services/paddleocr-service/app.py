# services/paddleocr-service/app.py
# PaddleOCR extraction service — accepts PDF, returns structured JSON.
# Deployed as a standalone container (Railway, Fly, etc).
#
# Performance: batch-rasterize all pages once, then OCR sequentially.
# PaddlePaddle's PP-Structure is not thread-safe so we can't parallelize
# the OCR step, but eliminating per-page rasterization is the big win.

import asyncio
import gc
import html as html_module
import logging
import os
import re
import time
import uuid
import tempfile
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pdf2image import convert_from_path, pdfinfo_from_path
from paddleocr import PPStructure

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("paddleocr-service")

app = FastAPI(title="PaddleOCR Extraction Service", version="1.3.0")

# Lazy-init the engine on first request (avoids slow import at module level
# in some deployment environments).
_engine: PPStructure | None = None

# Thread pool for CPU-bound OCR work — keeps event loop free for health checks
_executor = ThreadPoolExecutor(max_workers=1)

MAX_FILE_BYTES = int(os.environ.get("MAX_FILE_BYTES", str(10 * 1024 * 1024)))  # 10MB
MAX_PAGES = int(os.environ.get("MAX_PAGES", "100"))
DPI = int(os.environ.get("PADDLEOCR_DPI", "150"))

# API key for request authentication — optional (skip auth if not set).
PADDLEOCR_API_KEY = os.environ.get("PADDLEOCR_API_KEY")


def verify_api_key(request: Request):
    """Verify X-API-Key header matches PADDLEOCR_API_KEY env var.
    Skips check when env var is not set (local dev / unconfigured)."""
    if not PADDLEOCR_API_KEY:
        return
    key = request.headers.get("x-api-key")
    if key != PADDLEOCR_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def get_engine() -> PPStructure:
    global _engine
    if _engine is None:
        logger.info("Initializing PP-Structure engine...")
        _engine = PPStructure(show_log=False, recovery=True, lang="en")
        logger.info("PP-Structure engine ready")
    return _engine


@app.get("/health")
def health():
    return {"status": "ok", "engine": "paddleocr-pp-structure", "version": "1.3.0"}


def _process_pdf_sync(tmp_path: str, total_pages: int) -> dict:
    """Synchronous PDF processing — runs in thread pool to avoid blocking event loop.

    Performance strategy:
    - Batch-rasterize ALL pages in one pdf2image call (avoids re-parsing PDF per page)
    - Process each rasterized image through PP-Structure sequentially
      (PP-Structure is not thread-safe)
    - Free each image immediately after OCR to control memory
    """
    engine = get_engine()
    pages = []
    all_tables = []

    # === BATCH RASTERIZE ===
    # Single call converts all pages. This reads the PDF once instead of N times.
    raster_start = time.time()
    logger.info(f"Batch-rasterizing {total_pages} pages at {DPI} DPI...")
    all_images = convert_from_path(tmp_path, dpi=DPI)
    raster_ms = int((time.time() - raster_start) * 1000)
    logger.info(f"Rasterization complete: {len(all_images)} pages in {raster_ms}ms")

    # === OCR EACH PAGE ===
    for page_idx, img in enumerate(all_images):
        page_num = page_idx + 1
        ocr_start = time.time()

        img_array = np.array(img)
        width, height = img.width, img.height

        # Free PIL image immediately
        all_images[page_idx] = None  # type: ignore[assignment]
        del img

        result = engine(img_array)
        del img_array

        ocr_ms = int((time.time() - ocr_start) * 1000)
        logger.info(f"Page {page_num}/{total_pages}: {len(result)} regions in {ocr_ms}ms")

        blocks = []
        page_text_parts = []

        for idx, region in enumerate(result):
            region_type = region.get("type", "text")
            block_id = f"p{page_num}-b{idx}"

            if region_type == "table":
                table_html = region.get("res", {}).get("html", "")
                table_id = f"t-p{page_num}-{len(all_tables)}"

                values = _parse_table_html(table_html)
                rows_count = len(values)
                cols_count = max((len(row) for row in values), default=0)

                table_text_lines = []
                for row in values:
                    table_text_lines.append(" | ".join(row))
                table_text = "\n".join(table_text_lines)
                if table_text:
                    page_text_parts.append(table_text)

                table_entry = {
                    "table_id": table_id,
                    "page_number": page_num,
                    "table_index": len(all_tables),
                    "rows": rows_count,
                    "cols": cols_count,
                    "values": values,
                    "html": table_html,
                    "confidence": _avg_confidence(region),
                    "source_engine": "paddleocr",
                }
                all_tables.append(table_entry)

                blocks.append(
                    {
                        "block_id": block_id,
                        "type": "table",
                        "text": table_text or f"[Table: {rows_count}x{cols_count}]",
                        "table_id": table_id,
                        "confidence": table_entry["confidence"],
                        "bbox": _get_bbox(region),
                    }
                )
            else:
                text_lines = region.get("res", [])
                if isinstance(text_lines, list):
                    text = "\n".join(
                        line.get("text", str(line))
                        if isinstance(line, dict)
                        else str(line)
                        for line in text_lines
                    )
                elif isinstance(text_lines, dict):
                    text = text_lines.get("text", "")
                else:
                    text = str(text_lines)

                page_text_parts.append(text)

                block_type = "paragraph"
                if region_type == "title":
                    block_type = "heading"
                elif region_type == "list":
                    block_type = "list"

                blocks.append(
                    {
                        "block_id": block_id,
                        "type": block_type,
                        "text": text,
                        "confidence": _avg_confidence(region),
                        "bbox": _get_bbox(region),
                    }
                )

        del result

        page_tables = [t for t in all_tables if t["page_number"] == page_num]

        pages.append(
            {
                "page_number": page_num,
                "width": width,
                "height": height,
                "text": "\n".join(page_text_parts),
                "blocks": blocks,
                "tables": page_tables,
            }
        )

        # Periodic GC every 10 pages to keep memory in check
        if page_num % 10 == 0:
            gc.collect()

    # Final cleanup
    del all_images
    gc.collect()

    return {"pages": pages, "tables": all_tables}


@app.post("/api/extract")
async def extract(file: UploadFile = File(...), _auth=Depends(verify_api_key)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    start = time.time()
    tmp_path: str | None = None
    content_size = 0

    # Stream upload to temp file in chunks to prevent OOM on large uploads
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name
            while chunk := await file.read(65536):
                content_size += len(chunk)
                if content_size > MAX_FILE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (>{MAX_FILE_BYTES} bytes). Max: {MAX_FILE_BYTES}",
                    )
                tmp.write(chunk)
    except HTTPException:
        # Clean up temp file on size limit exceeded
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
        raise

    try:
        loop = asyncio.get_running_loop()
        info = await loop.run_in_executor(
            _executor, partial(pdfinfo_from_path, tmp_path)
        )
        total_pages = info.get("Pages", 0)
        if total_pages > MAX_PAGES:
            raise HTTPException(
                status_code=413,
                detail=f"Too many pages ({total_pages}). Max: {MAX_PAGES}",
            )

        logger.info(
            f"Starting extraction: {file.filename} ({content_size} bytes, {total_pages} pages)"
        )

        # Run CPU-bound OCR in thread pool — event loop stays free for health checks
        result = await loop.run_in_executor(
            _executor, partial(_process_pdf_sync, tmp_path, total_pages)
        )

        processing_time_ms = int((time.time() - start) * 1000)
        logger.info(
            f"Extraction complete: {file.filename} in {processing_time_ms}ms "
            f"({len(result['pages'])} pages, {len(result['tables'])} tables)"
        )

        return JSONResponse(
            {
                "document_id": str(uuid.uuid4()),
                "page_count": len(result["pages"]),
                "pages": result["pages"],
                "tables": result["tables"],
                "processing_time_ms": processing_time_ms,
                "engine_version": "paddleocr-pp-structure-2.9.1",
            }
        )

    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
        gc.collect()


def _parse_table_html(table_html: str) -> list[list[str]]:
    """Parse PP-Structure HTML table into a grid of cell text values.

    PP-Structure returns tables as HTML like:
      <table><thead><tr><td>H1</td><td>H2</td></tr></thead>
      <tbody><tr><td>V1</td><td>V2</td></tr></tbody></table>

    Returns a list of rows, each row a list of cell text strings.
    """
    if not table_html:
        return []

    rows: list[list[str]] = []
    current_row: list[str] = []
    in_cell = False
    cell_text = ""

    # Simple state-machine parser — avoids external dependency
    # Split on tags, process each
    parts = re.split(r"(<[^>]+>)", table_html)

    for part in parts:
        if not part:
            continue

        lower = part.lower().strip()

        if lower.startswith("<tr"):
            current_row = []
        elif lower == "</tr>":
            if current_row:
                rows.append(current_row)
        elif lower.startswith("<td") or lower.startswith("<th"):
            in_cell = True
            cell_text = ""
        elif lower in ("</td>", "</th>"):
            in_cell = False
            current_row.append(html_module.unescape(cell_text).strip())
        elif in_cell and not lower.startswith("<"):
            cell_text += part

    return rows


def _avg_confidence(region: dict) -> float:
    """Extract average OCR confidence from a PP-Structure region."""
    res = region.get("res", [])
    if isinstance(res, list):
        scores = []
        for item in res:
            if isinstance(item, dict) and "confidence" in item:
                scores.append(item["confidence"])
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                try:
                    scores.append(float(item[-1]))
                except (ValueError, TypeError):
                    pass
        return sum(scores) / len(scores) if scores else 0.7
    return 0.7


def _get_bbox(region: dict) -> list[float]:
    """Extract bounding box [x1, y1, x2, y2] from region."""
    bbox = region.get("bbox", [0, 0, 0, 0])
    if isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
        return [float(b) for b in bbox[:4]]
    return [0.0, 0.0, 0.0, 0.0]
