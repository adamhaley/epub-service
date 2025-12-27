import express from 'express';
import EPub from 'epub';
import fs from 'fs';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/parse-epub', async (req, res) => {
  const epubPath = req.body?.path;
  
  console.log('Received request with path:', epubPath);
  console.log('Path type:', typeof epubPath);
  console.log('Path truthy:', !!epubPath);
  
  try {
    if (!epubPath || typeof epubPath !== 'string') {
      console.log('Failed: Missing or invalid path');
      throw new Error('Missing or invalid path');
    }

    if (!epubPath.endsWith('.epub')) {
      console.log('Failed: Path must point to an .epub file');
      throw new Error('Path must point to an .epub file');
    }

    if (!fs.existsSync(epubPath)) {
      console.log('Failed: File not found');
      throw new Error('File not found');
    }
    
    console.log('All checks passed, creating EPub...');
    res.json({ status: 'File validation passed' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(8000, () => {
  console.log('Debug EPUB service listening on port 8000');
});