import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadState, buildWrite, commitWrite, paths } from './store.mjs';
import { lineDiff } from './diff.mjs';
import { startDev, stopDev, devStatus, gitStatus, gitDiffPreview, gitAdd, deploy } from './proc.mjs';

const PORT = Number(process.env.PORT) || 5177;
const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'content-type': 'application/json' });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function diffReport(next) {
  const { files, deletes, uploads } = buildWrite(next);
  const changed = files
    .filter((f) => f.oldText !== f.newText)
    .map((f) => ({ label: f.label, isNew: Boolean(f.isNew), lines: lineDiff(f.oldText, f.newText) }));
  const removed = deletes.map((d) => ({ label: d.label, isDeleted: true, lines: lineDiff(d.oldText, '') }));
  const added = uploads.map((u) => ({ label: u.label, isNew: true, lines: [] }));
  return [...changed, ...removed, ...added];
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/api/state') {
      return sendJson(res, 200, loadState());
    }

    if (req.method === 'POST' && url.pathname === '/api/diff') {
      const next = JSON.parse(await readBody(req));
      return sendJson(res, 200, { files: diffReport(next) });
    }

    if (req.method === 'POST' && url.pathname === '/api/commit') {
      const next = JSON.parse(await readBody(req));
      commitWrite(next);
      return sendJson(res, 200, { ok: true, state: loadState() });
    }

    if (req.method === 'GET' && url.pathname === '/api/dev/status') {
      return sendJson(res, 200, devStatus());
    }
    if (req.method === 'POST' && url.pathname === '/api/dev/start') {
      startDev();
      return sendJson(res, 200, devStatus());
    }
    if (req.method === 'POST' && url.pathname === '/api/dev/stop') {
      stopDev();
      return sendJson(res, 200, devStatus());
    }

    if (req.method === 'GET' && url.pathname === '/api/git/status') {
      return sendJson(res, 200, await gitStatus());
    }
    if (req.method === 'GET' && url.pathname === '/api/git/diff') {
      return sendJson(res, 200, await gitDiffPreview());
    }
    if (req.method === 'POST' && url.pathname === '/api/git/add') {
      return sendJson(res, 200, await gitAdd());
    }
    if (req.method === 'POST' && url.pathname === '/api/deploy') {
      return sendJson(res, 200, await deploy());
    }

    if (req.method === 'GET' && url.pathname === '/thumb') {
      const rel = url.searchParams.get('path') || '';
      if (rel.includes('..') || path.isAbsolute(rel)) return send(res, 400, 'bad path');
      const full = path.join(paths.galleryDir, rel);
      if (!full.startsWith(paths.galleryDir) || !fs.existsSync(full)) return send(res, 404, 'not found');
      return send(res, 200, fs.readFileSync(full), { 'content-type': 'image/jpeg' });
    }

    // static files
    let rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(PUBLIC_DIR, rel);
    if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full)) return send(res, 404, 'not found');
    const ext = path.extname(full);
    return send(res, 200, fs.readFileSync(full), { 'content-type': MIME[ext] || 'application/octet-stream' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: String(err.stack || err) });
  }
});

server.listen(PORT, () => {
  console.log(`Photo Site Manager running at http://localhost:${PORT}`);
});
