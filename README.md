# EPUB Chapter Extractor Service

A lightweight, internal FastAPI microservice for extracting **metadata and chapters** from EPUB files.

This service is designed to act as a **sidecar worker** in an automation stack (n8n, Supabase, Redis, etc.), removing heavy EPUB parsing logic from workflow engines and keeping orchestration clean.

---

## What This Service Does

Given an uploaded `.epub` file, the service:

- Extracts standard book metadata (title, author, language, etc.)
- Iterates through the EPUB spine in reading order
- Extracts full **HTML content** for each chapter
- Returns structured JSON suitable for downstream processing (classification, embeddings, storage)

This is a 1:1 replacement for EPUB parsing previously done inside an n8n Code node.

---

## Why This Exists

EPUB parsing is:
- CPU-heavy
- Stateful (temp files, binary handling)
- Hard to debug inside orchestration tools

By extracting it into a dedicated service:
- n8n stays focused on orchestration
- EPUB logic becomes testable and reusable
- The service can be reused for MOBI → EPUB pipelines later
- Internal-only exposure reduces attack surface

This is intentionally a **boring, dependable microservice**.

---

## API Overview

### `POST /parse-epub`

Accepts an EPUB file via `multipart/form-data`.

#### Request

- Content-Type: `multipart/form-data`
- Field name: `file`
- File type: `.epub`

#### Response

```json
{
  "metadata": {
    "title": "Book Title",
    "creator": "Author Name",
    "language": "en",
    "identifier": "urn:isbn:123456789",
    "publisher": "Publisher Name"
  },
  "chapters": [
    {
      "id": "chapter_1",
      "title": "Text/Chapter01.xhtml",
      "order": 0,
      "html": "<html>...</html>"
    }
  ]
}
```

---

## Project Structure

```
epub-service/
├── Dockerfile
├── requirements.txt
└── app/
    └── main.py
```

---

## Local Development (Optional)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Test with:

```bash
curl -X POST http://localhost:8000/parse-epub \
  -F "file=@example.epub"
```

---

## Docker Usage

### Build Image

```bash
docker build -t epub-service .
```

### Run Container

```bash
docker run -p 8000:8000 epub-service
```

---

## Docker Compose Integration

```yaml
services:
  epub-service:
    build: ./epub-service
    container_name: epub-service
    restart: unless-stopped
    networks:
      - default
```

Make sure n8n is on the same network:

```yaml
services:
  n8n:
    image: n8nio/n8n
    networks:
      - default

networks:
  default:
    external: true
```

---

## Calling from n8n

Use the **HTTP Request** node:

- Method: `POST`
- URL:
  ```
  http://epub-service:8000/parse-epub
  ```
- Send Binary Data: ✅
- Binary Property: `data`
- Content Type: `multipart/form-data`
- Field Name: `file`

No ports need to be exposed publicly.

---

## Notes & Design Choices

- EPUBs are written to a temp file and deleted after processing
- Chapters are returned in spine (reading) order
- Chapter `title` defaults to the internal EPUB filename
- HTML is returned unmodified for maximum downstream flexibility
- No authentication is included by default (intended for internal use)

---

## Future Enhancements (Optional)

- Extract human-readable chapter titles (`<h1>` / `<h2>`)
- Filter TOC, nav, copyright, and index sections
- Add chapter hashing for idempotent ingest
- Add text-only output mode
- Add `/health` endpoint
- Batch EPUB ingestion

---

## License

Internal service — adapt freely to your stack.

