import EPub from "epub";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/parse-epub", async (req, res) => {
  const epubPath = req.body?.path;

  if (!epubPath || typeof epubPath !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'path'" });
  }

  // Basic safety check (prevents accidental dirs / nonsense)
  if (!epubPath.endsWith(".epub")) {
    return res.status(400).json({ error: "Path must point to an .epub file" });
  }

  if (!fs.existsSync(epubPath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    const epub = new EPub(epubPath);

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

      // --- your existing filters ---
      if (!html.trim()) continue;

      if (item.id?.startsWith("index_split_")) continue;

      const idLower = item.id?.toLowerCase() || "";
      if (
        idLower.includes("toc") ||
        idLower.includes("index") ||
        idLower.includes("glossary") ||
        idLower.includes("copyright")
      ) {
        continue;
      }

      const textLength = html
        .replace(/<[^>]+>/g, "")
        .trim()
        .length;

      if (textLength < 300) continue;
      if (!item.title || !item.title.trim()) continue;

      chapters.push({
        order: item.order,
        title: item.title,
        html,
      });
    }

    res.json({
      metadata: epub.metadata,
      chapters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(8000, () => {
  console.log("EPUB service listening on port 8000");
});

