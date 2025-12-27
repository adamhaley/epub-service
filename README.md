# EPUB Service

A Node.js service for parsing EPUB files that can run as both a command-line tool and an HTTP service.

## Usage

### Command Line Mode

Parse an EPUB file directly from the command line:

```bash
node index.js /path/to/file.epub
```

The parsed content will be output as JSON to stdout.

### HTTP Service Mode

Start the HTTP service:

```bash
node index.js
```

The service will start on port 8000. Send a POST request to `/parse-epub` with the file path:

```bash
curl -X POST http://localhost:8000/parse-epub \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/file.epub"}'
```

## Installation

```bash
npm install
```

## Dependencies

- `epub` - EPUB parsing library
- `express` - HTTP server framework
- `multer` - File upload middleware

## Output Format

Both modes return the same JSON structure:

```json
{
  "metadata": {
    "title": "Book Title",
    "creator": "Author Name",
    // ... other metadata
  },
  "chapters": [
    {
      "order": 1,
      "title": "Chapter Title",
      "html": "<html>...</html>"
    }
    // ... more chapters
  ]
}
```