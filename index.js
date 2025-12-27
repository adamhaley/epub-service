import EPub from "epub";
import fs from "fs";
import express from "express";
import multer from "multer";

const upload = multer({ dest: "/tmp" });
const app = express();

app.post("/parse-epub", upload.single("file"), async (req, res) => {
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

  fs.unlinkSync(req.file.path);
});

app.listen(8000);

