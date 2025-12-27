from fastapi import FastAPI, UploadFile, File, HTTPException
from ebooklib import epub, ITEM_DOCUMENT
from lxml import html as lxml_html
import tempfile
import os
import re

app = FastAPI(title="EPUB Chapter Extractor")


def extract_visible_text(html_str: str) -> str:
    try:
        doc = lxml_html.fromstring(html_str)
        # Remove common non-content
        for bad in doc.xpath("//script|//style|//nav|//header|//footer"):
            bad.drop_tree()
        text = doc.text_content()
        text = re.sub(r"\s+", " ", text).strip()
        return text
    except Exception:
        return ""

def classify_spine_item(raw_title: str, text: str) -> dict:
    raw = raw_title.lower()

    # Strong filename hints for non-chapters
    if any(k in raw for k in ["toc", "contents", "index", "copyright", "titlepage", "cover"]):
        return {"content_type": "frontmatter", "is_real_chapter": False, "score": 0.0, "reason": "filename_hint"}

    # Text length thresholds (tuneable)
    n = len(text)

    if n >= 1500:
        return {"content_type": "chapter", "is_real_chapter": True, "score": 1.0, "reason": f"text_len={n}"}

    if n >= 600:
        return {"content_type": "maybe", "is_real_chapter": True, "score": 0.6, "reason": f"text_len={n}"}

    return {"content_type": "frontmatter", "is_real_chapter": False, "score": 0.2, "reason": f"text_len={n}"}


def extract_chapter_title(html_content: bytes, fallback: str) -> str:
    try:
        doc = lxml_html.fromstring(html_content)

        # Try h1, then h2
        for tag in ["h1", "h2"]:
            el = doc.find(f".//{tag}")
            if el is not None:
                text = el.text_content().strip()
                if text:
                    return text

    except Exception:
        pass

    return fallback


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


        chapters = []
        order = 0

        for item_id, _ in book.spine:
            item = book.get_item_with_id(item_id)
            if not item:
                continue

            if item.get_type() != ITEM_DOCUMENT:
                continue

            try:
                content = item.get_content()
                if not content:
                    continue

                raw_title = item.get_name()
                
                NON_CONTENT_HINTS = [
                    "titlepage",
                    "copyright",
                    "toc",
                    "contents",
                    "index"
                ]

                if any(hint in raw_title.lower() for hint in NON_CONTENT_HINTS):
                    continue

                display_title = extract_chapter_title(content, raw_title)

                chapters.append({
                    "id": item_id,
                    "raw_title": raw_title,
                    "title": display_title,
                    "order": order,
                    "html": content.decode("utf-8", errors="ignore")
                })

                order += 1

            except Exception as e:
                # Skip bad chapters, don't kill the whole book
                print(f"Skipping item {item_id}: {e}")
                continue


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

