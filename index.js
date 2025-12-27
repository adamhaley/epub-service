import EPub from "epub";
import express from "express";
import fs from "fs";
import path from "path";

async function parseEpub(epubPath) {
  if (!epubPath || typeof epubPath !== "string") {
    throw new Error("Missing or invalid path");
  }

  if (!epubPath.endsWith(".epub")) {
    throw new Error("Path must point to an .epub file");
  }

  if (!fs.existsSync(epubPath)) {
    throw new Error("File not found");
  }

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

  return {
    metadata: epub.metadata,
    chapters,
  };
}

function runCli() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error("Usage: node index.js <epub-file-path>");
    process.exit(1);
  }

  parseEpub(filePath)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

function runServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/parse-epub", async (req, res) => {
    const epubPath = req.body?.path;

    try {
      const result = await parseEpub(epubPath);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(8000, () => {
    console.log("EPUB service listening on port 8000");
  });
}

if (process.argv.length > 2) {
  runCli();
} else {
  runServer();
}

