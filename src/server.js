import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { retrieve } from './retrieve.js';
import { answer } from './answer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_INDEX_PATH = path.resolve(__dirname, '..', 'public', 'index.html');
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        const html = fs.readFileSync(PUBLIC_INDEX_PATH, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/docs/')) {
        const filename = path.basename(pathname);
        const docPath = path.join(DOCS_DIR, filename);
        if (
          filename.endsWith('.md') &&
          docPath.startsWith(DOCS_DIR) &&
          fs.existsSync(docPath)
        ) {
          const content = fs.readFileSync(docPath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
          res.end(content);
          return;
        }
        sendJson(res, 404, { error: 'Document not found' });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/chat') {
        const rawBody = await readRequestBody(req);
        let parsed;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        if (
          !parsed ||
          typeof parsed !== 'object' ||
          typeof parsed.question !== 'string' ||
          parsed.question.trim().length === 0
        ) {
          sendJson(res, 400, { error: 'Question must be a non-empty string' });
          return;
        }

        const passages = retrieve(parsed.question);
        const result = await answer(parsed.question, passages);

        sendJson(res, 200, {
          answer: result.text,
          citations: result.citations,
          refused: result.refused
        });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, 500, { error: err?.message || 'Internal server error' });
    }
  });
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const port = Number(process.env.PORT) || 3917;
  const server = createServer();
  server.listen(port, () => {
    console.log(`Quillnote chat server listening on http://localhost:${port}`);
  });
}
