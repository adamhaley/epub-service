import EPub from "epub";
import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";

function writeTempFile(buffer) {
  const tmpPath = path.join(
    os.tmpdir(),
    `epub-${Date.now()}-${Math.random().toString(36).slice(2)}.epub`
  );
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.post("/parse-epub", upload.single("file"), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "No file received" });
  }

  let tmpPath;

  try {
    tmpPath = writeTempFile(req.file.buffer);
    const epub = new EPub(tmpPath);

    await new Promise((resolve, reject) => {
      epub.on("error", reject);
      epub.on("end", resolve);
      epub.parse();
    });

    const chapters = [];

    for (const item of epub.flow) {
      const html = await new Promise((resolve, reject) => {
        epub.getChapter(item.id, (err, text) => {
          if (err) reject(err);
          else resolve(text || "");
        });
      });

      // 1. Skip empty chapters
      if (!html.trim()) continue;

      // 2. Skip obvious Calibre split artifacts
      if (item.id?.startsWith("index_split_")) continue;

      // 3. Skip obvious non-content docs by id
      const idLower = item.id?.toLowerCase() || "";
      if (
        idLower.includes("toc") ||
        idLower.includes("index") ||
        idLower.includes("glossary") ||
        idLower.includes("copyright")
      ) {
        continue;
      }

      // 4. Skip very small content
      const textLength = html
        .replace(/<[^>]+>/g, "")
        .trim()
        .length;

      if (textLength < 300) continue;

      if (!item.title || !item.title.trim()) continue;

      chapters.push({
        order: item.order,
        title: item.title,
        html
      });
    }

    res.json({
      metadata: epub.metadata,
      chapters
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
});

app.listen(8000, () => {
  console.log("EPUB service listening on port 8000");
});
