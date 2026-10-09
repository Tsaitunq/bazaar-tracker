// usage: node scripts/serve.mjs [port] - serves the current directory on 127.0.0.1
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { rel = null; }
  const p = rel && path.join(root, rel.replace(/\/$/, '/index.html'));
  if (!p || (p !== root && !p.startsWith(root + path.sep))) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(p, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' });
    res.end(err ? 'not found' : data);
  });
}).listen(Number(process.argv[2]) || 8123, '127.0.0.1');
