import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import urlRoutes from './routes/urlRoutes.js';
import Url from './models/Url.js';

dotenv.config();

// Connect to MongoDB
connectDB();

function parseUserAgent(ua) {
  let device = 'Desktop';
  let browser = 'Other';
  if (!ua) return { device, browser };
  const uaLower = ua.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(uaLower)) {
    device = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|webos/i.test(uaLower)) {
    device = 'Mobile';
  }
  if (/firefox|fxios/i.test(uaLower)) {
    browser = 'Firefox';
  } else if (/opr\/|opera/i.test(uaLower)) {
    browser = 'Opera';
  } else if (/edg/i.test(uaLower)) {
    browser = 'Edge';
  } else if (/chrome|crios/i.test(uaLower)) {
    browser = 'Chrome';
  } else if (/safari/i.test(uaLower) && !/chrome|crios|android/i.test(uaLower)) {
    browser = 'Safari';
  }
  return { device, browser };
}

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', urlRoutes);

// Redirect Route
app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Alphanumeric + hyphens, 3 to 50 chars
    if (!/^[a-zA-Z0-9\-]{3,50}$/.test(code)) {
      return res.status(404).send('Invalid short code format.');
    }

    const url = await Url.findOne({
      $or: [
        { shortCode: code },
        { vanityCode: code }
      ]
    });

    if (url) {
      // --- Check: link expiry by date ---
      if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
        return res.status(410).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Expired</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}div{background:#1e293b;border:1px solid #334155;padding:48px 56px;text-align:center;max-width:420px;border-radius:8px}h2{margin:0 0 12px;font-size:22px;color:#f8fafc}p{margin:0;color:#94a3b8;font-size:15px}span{display:inline-block;margin-bottom:20px;font-size:40px}</style></head><body><div><span>⏰</span><h2>This link has expired</h2><p>The short URL <strong>${url.shortCode}</strong> is no longer active because it passed its expiry date.</p></div></body></html>`);
      }

      // --- Check: link expiry by max clicks ---
      if (url.maxClicks !== null && url.clicks >= url.maxClicks) {
        return res.status(410).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Expired</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}div{background:#1e293b;border:1px solid #334155;padding:48px 56px;text-align:center;max-width:420px;border-radius:8px}h2{margin:0 0 12px;font-size:22px;color:#f8fafc}p{margin:0;color:#94a3b8;font-size:15px}span{display:inline-block;margin-bottom:20px;font-size:40px}</style></head><body><div><span>🔢</span><h2>Click limit reached</h2><p>The short URL <strong>${url.shortCode}</strong> has reached its maximum click limit of <strong>${url.maxClicks}</strong>.</p></div></body></html>`);
      }

      // --- Check: link is paused/disabled ---
      if (url.active === false) {
        return res.status(403).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Disabled</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}div{background:#1e293b;border:1px solid #334155;padding:48px 56px;text-align:center;max-width:420px;border-radius:8px}h2{margin:0 0 12px;font-size:22px;color:#f8fafc}p{margin:0;color:#94a3b8;font-size:15px}span{display:inline-block;margin-bottom:20px;font-size:40px}</style></head><body><div><span>⏸️</span><h2>This link is currently disabled</h2><p>The short URL <strong>${url.shortCode}</strong> has been temporarily paused by the owner.</p></div></body></html>`);
      }

      // --- Check: password protection ---
      if (url.password) {
        const passwordPage = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Password Required</title><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}div.card{background:#1e293b;border:1px solid #334155;padding:40px 48px;max-width:380px;width:100%;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3)}h2{margin:0 0 8px;font-size:20px;color:#f8fafc}p{margin:0 0 20px;color:#94a3b8;font-size:14px}input{width:100%;padding:10px 12px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-size:14px;margin-bottom:12px;outline:none;border-radius:4px}input:focus{border-color:#06b6d4}button{width:100%;padding:10px;background:#06b6d4;color:#0f172a;border:none;font-size:14px;font-weight:bold;cursor:pointer;border-radius:4px;transition:background 0.2s}button:hover{background:#22d3ee}.error{color:#f87171;font-size:13px;margin-bottom:10px;display:none}span{font-size:32px;display:block;margin-bottom:16px}</style></head><body><div class="card"><span>🔒</span><h2>Password Required</h2><p>This link is password protected. Enter the password to continue.</p><div class="error" id="err">Incorrect password. Try again.</div><input type="password" id="pwd" placeholder="Enter password" /><button onclick="verify()">Continue</button></div><script>async function verify(){const pwd=document.getElementById('pwd').value;const res=await fetch('/verify-password/${url.shortCode}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pwd})});if(res.ok){const d=await res.json();window.location.href=d.url;}else{document.getElementById('err').style.display='block';}}</script></body></html>`;
        return res.send(passwordPage);
      }

      // Increment clicks and record click event
      url.clicks += 1;
      const ua = req.headers['user-agent'] || '';
      const { device, browser } = parseUserAgent(ua);
      url.clickEvents.push({
        timestamp: new Date(),
        referrer: req.headers.referer || req.headers.referrer || '',
        userAgent: ua,
        device,
        browser,
      });
      // Keep last 500 click events to prevent unbounded growth
      if (url.clickEvents.length > 500) {
        url.clickEvents = url.clickEvents.slice(-500);
      }
      await url.save();
      return res.redirect(url.longUrl);
    } else {
      return res.status(404).send('Short URL not found.');
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server Error');
  }
});

// Password verification route for password-protected links
app.post('/verify-password/:code', express.json(), async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body;
    const url = await Url.findOne({
      $or: [{ shortCode: code }, { vanityCode: code }]
    });
    if (!url || !url.password) {
      return res.status(404).json({ error: 'Link not found' });
    }
    const match = await bcrypt.compare(password, url.password);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    // Increment clicks on successful password
    url.clicks += 1;
    const ua = req.headers['user-agent'] || '';
    const { device, browser } = parseUserAgent(ua);
    url.clickEvents.push({
      timestamp: new Date(),
      referrer: req.headers.referer || req.headers.referrer || '',
      userAgent: ua,
      device,
      browser,
    });
    if (url.clickEvents.length > 500) {
      url.clickEvents = url.clickEvents.slice(-500);
    }
    await url.save();
    return res.json({ url: url.longUrl });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files in production if dist exists
const distPath = path.join(__dirname, '../frontend/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('URL Shortener API is running.');
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
