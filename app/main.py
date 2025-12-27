from fastapi import FastAPI, UploadFile, File, HTTPException
from ebooklib import epub
import tempfile
import os

app = FastAPI(title="EPUB Chapter Extractor")


@app.post("/parse-epub")
async def parse_epub(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".epub"):
        raise HTTPException(status_code=400, detail="File must be an EPUB")

    tmp_path = None

    try:
        # --------------------------------------------------
        # 1. Save uploaded EPUB
        # --------------------------------------------------
        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # --------------------------------------------------
        # 2. Load EPUB
        # --------------------------------------------------
        book = epub.read_epub(tmp_path)

        # --------------------------------------------------
        # 3. Metadata
        # --------------------------------------------------
        metadata = {
            "title": _first_meta(book, "title"),
            "creator": _first_meta(book, "creator"),
            "language": _first_meta(book, "language"),
            "identifier": _first_meta(book, "identifier"),
            "publisher": _first_meta(book, "publisher"),
        }

        # --------------------------------------------------
        # 4. Chapters (spine order)
        # --------------------------------------------------
        chapters = []
        order = 0

        for item_id, _ in book.spine:
            item = book.get_item_with_id(item_id)
            if not item:
                continue

            if item.get_type() == epub.ITEM_DOCUMENT:
                content = item.get_content().decode("utf-8", errors="ignore")

                chapters.append({
                    "id": item_id,
                    "title": item.get_name(),
                    "order": order,
                    "html": content
                })
                order += 1

        return {
            "metadata": metadata,
            "chapters": chapters
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


def _first_meta(book, name):
    values = book.get_metadata("DC", name)
    return values[0][0] if values else None

