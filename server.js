import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const apiHandlers = {};

async function loadApiHandler(route) {
  if (apiHandlers[route]) return apiHandlers[route];

  // Route is e.g. /api/health or /api/vapi/webhook — always resolve under project root
  const rel = route.replace(/^\/+/, '');
  const filePath = join(__dirname, `${rel}.js`);
  try {
    await stat(filePath);
    const mod = await import(`file://${filePath.replace(/\\/g, '/')}`);
    apiHandlers[route] = mod.default;
    return mod.default;
  } catch {
    return null;
  }
}

function createReqShim(req, body) {
  req.body = body;
  return req;
}

function createResShim(res) {
  const shim = {
    _statusCode: 200,
    _headers: {},

    status(code) {
      shim._statusCode = code;
      return shim;
    },
    setHeader(key, value) {
      shim._headers[key] = value;
      res.setHeader(key, value);
      return shim;
    },
    writeHead(code, headers) {
      shim._statusCode = code;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          res.setHeader(k, v);
        }
      }
      return shim;
    },
    json(data) {
      if (!res.headersSent) {
        res.writeHead(shim._statusCode, { 'Content-Type': 'application/json', ...shim._headers });
      }
      res.end(JSON.stringify(data));
    },
    send(data) {
      if (!res.headersSent) {
        res.writeHead(shim._statusCode, shim._headers);
      }
      res.end(data);
    },
    write(chunk) {
      if (!res.headersSent) {
        res.writeHead(shim._statusCode, shim._headers);
      }
      res.write(chunk);
    },
    end(data) {
      if (!res.headersSent) {
        res.writeHead(shim._statusCode, shim._headers);
      }
      res.end(data);
    },
  };
  return shim;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    const route = pathname.replace(/\/$/, '');
    const handler = await loadApiHandler(route);

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API route not found' }));
      return;
    }

    let body = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
    }

    const reqShim = createReqShim(req, body);
    const resShim = createResShim(res);

    try {
      await handler(reqShim, resShim);
    } catch (err) {
      console.error(`API error [${route}]:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  let filePath = join(__dirname, pathname === '/' ? 'index.html' : pathname);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    const content = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  Local server running at http://localhost:${PORT}\n`);
});
