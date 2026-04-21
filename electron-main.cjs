const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'widget-config.json');

// Scraping logic moved to Main Process for standalone exe
async function fetchWeather() {
  try {
    const response = await axios.get('https://infometeo.pl/krakow', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const metarText = $('pre.metar').text();

    if (!metarText) {
      throw new Error('METAR data not found');
    }

    const wiatrMatch = metarText.match(/WIATR[\s.]+.*?\s(\d+)\s+km\/h/i);
    const tempMatch = metarText.match(/TEMPERATURA[\s.]+.*?(-?\d+)°C/i);
    const humMatch = metarText.match(/WILGOTNOŚĆ[\s.]+.*?(\d+)%/i);

    return {
      wind: wiatrMatch ? wiatrMatch[1] : null,
      temperature: tempMatch ? tempMatch[1] : null,
      humidity: humMatch ? humMatch[1] : null,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Scraping error:', error.message);
    throw error;
  }
}

ipcMain.handle('get-weather', async () => {
  return await fetchWeather();
});

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
  return { x: undefined, y: undefined };
}

function saveConfig(bounds) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(bounds));
  } catch (e) {
    console.error('Failed to save config', e);
  }
}

function createWindow() {
  const config = loadConfig();

  mainWindow = new BrowserWindow({
    title: "Pogoda KRK",
    width: 600,
    height: 80,
    x: config.x,
    y: config.y,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Prevent minimization since there's no taskbar icon to restore it
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.restore();
  });

  mainWindow.on('move', () => {
    saveConfig(mainWindow.getBounds());
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
