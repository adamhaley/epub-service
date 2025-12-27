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

      if (!html.trim()) continue;

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

