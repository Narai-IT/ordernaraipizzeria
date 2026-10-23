#!/usr/bin/env node
// เซิร์ฟเวอร์สำหรับลองบนเครื่อง — เสิร์ฟ public/ และเรียก api/*.js แบบเดียวกับ Vercel (ไม่ต้องติดตั้งอะไรเพิ่ม)
//
//   node scripts/dev-server.mjs          ต่อหลังบ้านจริง (ตั้ง env แบบเดียวกับ .env.example ก่อน)
//   node scripts/dev-server.mjs --demo   ข้อมูลตัวอย่างในเบราว์เซอร์ ไม่ต้องมี env
//   PORT=5173 เปลี่ยนพอร์ต (ค่าเริ่มต้น 3000)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PUBLIC = join(ROOT, 'public');
const DEMO = process.argv.includes('--demo');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

/** req/res แบบ Vercel: req.query, req.body, res.status().json() */
function vercelify(req, res, url, rawBody) {
  req.query = Object.fromEntries(url.searchParams);
  try { req.body = rawBody ? JSON.parse(rawBody) : {}; } catch { req.body = rawBody; }
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); return res; };
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z_]/gi, '');
      const chunks = [];
      for await (const c of req) chunks.push(c);
      vercelify(req, res, url, Buffer.concat(chunks).toString('utf8'));
      const mod = await import(join(ROOT, 'api', `${name}.js`));
      return await mod.default(req, res);
    }
    const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    let body = await readFile(join(PUBLIC, rel));
    if (rel === '/index.html' && DEMO) body = Buffer.from(body.toString('utf8').replace('content="live"', 'content="demo"'));
    res.setHeader('Content-Type', TYPES[extname(rel)] || 'application/octet-stream');
    res.end(body);
  } catch (e) {
    res.statusCode = e.code === 'ENOENT' || e.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500;
    res.end(res.statusCode === 404 ? 'not found' : String(e.stack || e));
  }
}).listen(PORT, () => console.log(`เปิด http://localhost:${PORT}${DEMO ? ' (โหมดตัวอย่าง)' : ''}`));
