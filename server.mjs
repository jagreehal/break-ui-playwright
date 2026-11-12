// Serves app/ and the members API that break-ui's toggle swaps fixtures behind. `node server.mjs` and open :4377.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { datasets } from './app/fixtures.js';

const root = join(import.meta.dirname, 'app');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT ?? 4377);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/members') {
    const data = datasets[url.searchParams.get('data') ?? 'demo'];
    res.writeHead(data ? 200 : 404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(data ?? { error: 'unknown dataset' }));
  }
  const file = join(root, normalize(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
