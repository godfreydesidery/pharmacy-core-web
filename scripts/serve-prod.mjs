// Serves the production build (dist/pharmacy-core-web/browser) and proxies /api, /actuator,
// /v3/api-docs and /swagger-ui to the API, like the dev server's proxy.conf.json does.
// Usage: npm run serve:prod   (PORT=4300 API_URL=http://localhost:8080)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/pharmacy-core-web/browser/', import.meta.url));
const port = Number(process.env.PORT ?? 4300);
const api = new URL(process.env.API_URL ?? 'http://localhost:8080');
const proxied = ['/api/', '/actuator', '/v3/api-docs', '/swagger-ui'];
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No production build at ${root}. Run npm run build first.`);
  process.exit(1);
}

createServer((req, res) => {
  const url = req.url ?? '/';
  if (proxied.some((prefix) => url.startsWith(prefix))) {
    // Same-origin for the browser: the API sees a server-to-server call, so no CORS Origin.
    const { origin: _origin, referer: _referer, ...headers } = req.headers;
    const upstream = request(
      { host: api.hostname, port: api.port, path: url, method: req.method, headers: { ...headers, host: api.host } },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (res.headersSent) {
        // The API went away mid-response (say, a notification stream when it restarts): end
        // this one connection; the browser reconnects. Writing headers again would crash.
        res.destroy();
        return;
      }
      res.writeHead(502, { 'content-type': 'application/problem+json' });
      res.end(JSON.stringify({ status: 502, reason: 'api_unreachable', detail: `API at ${api.origin} is not reachable.` }));
    });
    req.pipe(upstream);
    return;
  }
  const path = normalize(decodeURIComponent(url.split('?')[0])).replace(/^([/\\])+/, '');
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    if (extname(path)) {
      // A missing file (say, a page chunk from an older build) is a 404, never index.html:
      // served as HTML it fails as a module and the link that needed it silently does nothing.
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
      res.end('Not found');
      return;
    }
    file = join(root, 'index.html'); // SPA fallback for app routes
  }
  const hashed = /\.[0-9a-z]{8,}\.(js|css)$/i.test(file);
  res.writeHead(200, {
    'content-type': types[extname(file)] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`pharmacy-core-web (production build) on http://localhost:${port} → API ${api.origin}`));
