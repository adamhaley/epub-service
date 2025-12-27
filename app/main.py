from fastapi import FastAPI, UploadFile, File, HTTPException
from ebooklib import epub
from bs4 import BeautifulSoup
import tempfile
import os
import shutil

app = FastAPI(title="EPUB Parser Service")


def extract_text_from_item(item) -> str:
    """
    Extract visible paragraph text from an EPUB HTML document.
    """
    soup = BeautifulSoup(item.get_body_content(), "html.parser")
    paragraphs = [
        p.get_text(" ", strip=True)
        for p in soup.find_all("p")
    ]
    return "\n\n".join(paragraphs)


@app.post("/parse-epub")
async def parse_epub(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".epub"):
        raise HTTPException(status_code=400, detail="File must be an EPUB")

    tmp_path = None

    try:
        # --------------------------------------------------
        # Save uploaded EPUB to temp file
        # --------------------------------------------------
        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # --------------------------------------------------
        # Load EPUB
        # --------------------------------------------------
        book = epub.read_epub(tmp_path)

        # --------------------------------------------------
        # Metadata (minimal, safe)
        # --------------------------------------------------
        def get_meta(name):
            values = book.get_metadata("DC", name)
            return values[0][0] if values else None

        metadata = {
            "title": get_meta("title"),
            "creator": get_meta("creator"),
            "language": get_meta("language"),
            "identifier": get_meta("identifier"),
            "publisher": get_meta("publisher"),
        }

        # --------------------------------------------------
        # Extract chapters (boring by design)
        # --------------------------------------------------
        chapters = []
        order = 0

        for item_id, _ in book.spine:
            item = book.get_item_with_id(item_id)
            if not item:
                continue

            if item.get_type() != epub.ITEM_DOCUMENT:
                continue

            text = extract_text_from_item(item)
            if not text.strip():
                continue

            chapters.append({
                "order": order,
                "content": text
            })

            order += 1

        return {
            "metadata": metadata,
            "chapters": chapters
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

