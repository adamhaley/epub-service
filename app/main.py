from fastapi import FastAPI, UploadFile, File
from ebooklib import epub
from bs4 import BeautifulSoup
import tempfile
import os

app = FastAPI()


def extract_text(item):
    soup = BeautifulSoup(item.get_body_content(), "html.parser")

    paragraphs = [
        p.get_text(" ", strip=True)
        for p in soup.find_all("p")
    ]

    return "\n\n".join(paragraphs)


@app.post("/parse-epub")
async def parse_epub(file: UploadFile = File(...)):
    tmp_path = None

    try:
        # Save uploaded epub to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        book = epub.read_epub(tmp_path)

        metadata = {
            "title": (book.get_metadata("DC", "title") or [[None]])[0][0],
            "creator": (book.get_metadata("DC", "creator") or [[None]])[0][0],
            "language": (book.get_metadata("DC", "language") or [[None]])[0][0],
            "identifier": (book.get_metadata("DC", "identifier") or [[None]])[0][0],
            "publisher": (book.get_metadata("DC", "publisher") or [[None]])[0][0],
        }

        chapters = []
        order = 0

        for item_id, _ in book.spine:
            item = book.get_item_with_id(item_id)
            if not item:
                continue

            if item.get_type() != epub.ITEM_DOCUMENT:
                continue

            text = extract_text(item)
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

