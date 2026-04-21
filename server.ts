import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import cors from 'cors';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API route to get weather data
  app.get('/api/weather', async (req, res) => {
    try {
      const response = await axios.get('https://infometeo.pl/krakow', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      const metarText = $('pre.metar').text();

      if (!metarText) {
        return res.status(404).json({ error: 'METAR data not found on the page' });
      }

      // Parsing logic
      const wiatrMatch = metarText.match(/WIATR[\s.]+.*?\s(\d+)\s+km\/h/i);
      const tempMatch = metarText.match(/TEMPERATURA[\s.]+.*?(-?\d+)°C/i);
      const humMatch = metarText.match(/WILGOTNOŚĆ[\s.]+.*?(\d+)%/i);

      res.json({
        wind: wiatrMatch ? wiatrMatch[1] : null,
        temperature: tempMatch ? tempMatch[1] : null,
        humidity: humMatch ? humMatch[1] : null,
        raw: metarText,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Scraping error:', error.message);
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
