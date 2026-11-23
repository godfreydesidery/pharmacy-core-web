// Serves the production build (dist/pharmacy-core-web/browser) and proxies the API under /api (and
// its health probe), so the browser talks to one origin and needs no CORS.
// Usage: npm run serve:prod   (PORT=4300 API_URL=http://localhost:8080)
//
// Hardening (OWASP Secure Headers, RFC 9110/9111):
// - security headers on every page and file: a Content Security Policy, frame-ancestors 'none',
//   HSTS, nosniff, Referrer-Policy and Permissions-Policy;
// - a malformed URL is a 400, never a crash;
// - hashed build files are cached for a year (immutable), index.html is revalidated with an ETag,
//   and text is sent brotli- or gzip-compressed;
// - the client's own X-Forwarded-For / Forwarded headers are dropped and the API gets X-Real-IP
//   from the edge this server sits behind (CLIENT_IP_SOURCE), so a client cannot choose the IP
//   the API records:
//     x-real-ip (default): Railway's edge overwrites X-Real-IP with the address that connected;
//     x-forwarded-for: an AWS ALB appends the connecting address as the LAST X-Forwarded-For
//       entry (earlier entries are whatever the client sent), so only that last entry is used;
//     socket: this connection's own address (no trusted edge; TRUST_EDGE_IP=false means this);
// - when the browser goes away, the request to the API is ended too (no orphaned streams).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../dist/pharmacy-core-web/browser/', import.meta.url));
const port = Number(process.env.PORT ?? 4300);
const api = new URL(process.env.API_URL ?? 'http://localhost:8080');
const clientIpSource =
  process.env.CLIENT_IP_SOURCE ?? (process.env.TRUST_EDGE_IP === 'false' ? 'socket' : 'x-real-ip');
if (!['x-real-ip', 'x-forwarded-for', 'socket'].includes(clientIpSource)) {
  throw new Error(`CLIENT_IP_SOURCE must be x-real-ip, x-forwarded-for or socket`);
}

/** The client's address as the trusted edge reports it, else this connection's. */
function clientIp(req) {
  let edge;
  if (clientIpSource === 'x-real-ip') {
    edge = req.headers['x-real-ip'];
  } else if (clientIpSource === 'x-forwarded-for') {
    const chain = String(req.headers['x-forwarded-for'] ?? '').split(',');
    edge = chain[chain.length - 1]?.trim();
  }
  return typeof edge === 'string' && edge ? edge : (req.socket.remoteAddress ?? '');
}
// Where uploaded files are fetched from when they live in S3/R2 (an origin like
// https://files.example.com); the local store is served by the API on this origin.
const filesOrigin = process.env.FILES_ORIGIN ? ` ${process.env.FILES_ORIGIN}` : '';
const proxied = ['/api/', '/actuator/health'];
const stream = '/api/v1/notifications/stream';
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
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
// Angular names build files name-HASH.js (main-UKFQBCHS.js, chunk-ZVIDVIIZ.js, styles-V2BTIOPQ.css).
const hashedName = /-[A-Z0-9]{8,}\.(?:js|css)$/;
// Request headers that describe one connection, not the request (RFC 9110 §7.6.1), and the
// client's own claims about where it is.
const dropped = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade',
  'origin',
  'referer',
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
]);

const security = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob:${filesOrigin}`,
    `connect-src 'self'${filesOrigin}`,
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No production build at ${root}. Run npm run build first.`);
  process.exit(1);
}

/** A build file read once: its bytes, ETag and compressed forms (the build never changes). */
const files = new Map();
function load(file) {
  let entry = files.get(file);
  if (!entry) {
    const body = readFileSync(file);
    const zip = compressible.has(extname(file)) && body.length > 1024;
    entry = {
      body,
      etag: `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`,
      br: zip
        ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
        : null,
      gzip: zip ? gzipSync(body, { level: 9 }) : null,
    };
    files.set(file, entry);
  }
  return entry;
}

function proxy(req, res, url) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!dropped.has(name) && name !== 'x-real-ip') headers[name] = value;
  }
  headers['x-real-ip'] = clientIp(req);
  headers.host = api.host;
  const upstream = request(
    { host: api.hostname, port: api.port, path: url, method: req.method, headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
      res.on('close', () => answer.destroy());
    },
  );
  // The browser left (a closed tab, a reload, a dropped stream): end the call to the API too.
  res.on('close', () => upstream.destroy());
  if (!url.startsWith(stream)) {
    // No byte for five minutes on an ordinary call (exports stream as they go): give up on it.
    upstream.setTimeout(300_000, () => upstream.destroy(new Error('timeout')));
  }
  upstream.on('error', (error) => {
    if (res.headersSent || res.destroyed) {
      // The API went away mid-response (say, a notification stream when it restarts): end
      // this one connection; the browser reconnects. Writing headers again would crash.
      res.destroy();
      return;
    }
    console.error(`API call ${req.method} ${url.split('?')[0]} failed: ${error.message}`);
    res.writeHead(502, { 'content-type': 'application/problem+json', ...security });
    res.end(
      JSON.stringify({
        status: 502,
        reason: 'api_unreachable',
        detail: 'The server is not reachable; try again.',
      }),
    );
  });
  req.pipe(upstream);
}

function serve(req, res, url) {
  let path;
  try {
    path = normalize(decodeURIComponent(url.split('?')[0])).replace(/^([/\\])+/, '');
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', ...security });
    res.end('Bad request');
    return;
  }
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    if (extname(path)) {
      // A missing file (say, a page chunk from an older build) is a 404, never index.html:
      // served as HTML it fails as a module and the link that needed it silently does nothing.
      res.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-cache',
        ...security,
      });
      res.end('Not found');
      return;
    }
    file = join(root, 'index.html'); // SPA fallback for app routes
  }
  const entry = load(file);
  const headers = {
    'content-type': types[extname(file)] ?? 'application/octet-stream',
    'cache-control': hashedName.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
    etag: entry.etag,
    vary: 'accept-encoding',
    ...security,
  };
  if (req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const accepted = String(req.headers['accept-encoding'] ?? '');
  let body = entry.body;
  if (entry.br && /\bbr\b/.test(accepted)) {
    body = entry.br;
    headers['content-encoding'] = 'br';
  } else if (entry.gzip && /\bgzip\b/.test(accepted)) {
    body = entry.gzip;
    headers['content-encoding'] = 'gzip';
  }
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  try {
    if (proxied.some((prefix) => url.startsWith(prefix))) {
      proxy(req, res, url);
    } else {
      serve(req, res, url);
    }
  } catch (error) {
    // One bad request must never take the server (and every till) down.
    console.error(`Request ${req.method} ${url.split('?')[0]} failed: ${error?.message ?? error}`);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', ...security });
    }
    res.end();
  }
});
// A request the HTTP parser cannot read (bad header, oversized line): answer 400 and close.
server.on('clientError', (_error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nconnection: close\r\n\r\n');
  else socket.destroy();
});
server.listen(port, () =>
  console.log(
    `pharmacy-core-web (production build) on http://localhost:${port} → API ${api.origin}`,
  ),
);
