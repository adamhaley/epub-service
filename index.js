import EPub from "epub";
import express from "express";
import multer from "multer";
import fs from "fs";

const upload = multer({ dest: "/tmp" });
const app = express();

app.post("/parse-epub", upload.single("file"), async (req, res) => {
  try {
    const epub = new EPub(req.file.path);

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

          // 4. Skip very small content (covers, separators, nav pages)
          const textLength = html
            .replace(/<[^>]+>/g, "")
            .trim()
            .length;

          if (textLength < 300) continue;

          // 5. Only now do we accept it as a candidate chapter
          chapters.push({
            order: item.order,
            title: item.title || null,
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
    if (req.file?.path) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.listen(8000, () => {
  console.log("EPUB service listening on port 8000");
});

