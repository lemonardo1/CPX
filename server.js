'use strict';

const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ROOT_DIR = '/Users/daeseong/CPX';
const LOG_PATH = path.join(ROOT_DIR, 'log.json');
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// Basic no-cache for JSON endpoints
app.use((req, res, next) => {
  if (req.path.endsWith('.json') || req.path === '/log') {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Serve static files
app.use(express.static(ROOT_DIR));

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Append to log.json
app.post('/log', async (req, res) => {
  try {
    const payload = req.body || {};
    const entry = {
      case: payload.case ?? null,
      checklist: {
        main: payload?.checklist?.main ?? {},
        sub: payload?.checklist?.sub ?? {}
      }
    };

    let current = [];
    try {
      const raw = await fsp.readFile(LOG_PATH, 'utf8');
      if (raw && raw.trim().length > 0) {
        current = JSON.parse(raw);
        if (!Array.isArray(current)) current = [];
      }
    } catch (e) {
      // If file doesn't exist or invalid JSON, start fresh
      current = [];
    }

    current.push(entry);
    const tmpPath = LOG_PATH + '.tmp';
    await fsp.writeFile(tmpPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
    await fsp.rename(tmpPath, LOG_PATH);

    res.json({ ok: true, count: current.length });
  } catch (err) {
    console.error('Failed to append log:', err);
    res.status(500).json({ ok: false, error: 'failed_to_append_log' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`CPX server listening at http://127.0.0.1:${PORT}`);
});


