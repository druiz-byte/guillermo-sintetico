// Servidor Node para Render (https://render.com): reutiliza la lógica de worker/src/index.js.
// Arranque: npm start   ·   Variables: las mismas que en el Worker (ver README).
import http from 'node:http';
import handler from '../worker/src/index.js';

// Sustituto sencillo de la caché de Cloudflare (en memoria; se vacía si Render reinicia el servicio).
const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 400);
const store = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      const e = store.get(req.url);
      if (!e) return undefined;
      if (Date.now() > e.expires) { store.delete(req.url); return undefined; }
      return new Response(e.body, { status: e.status, headers: e.headers });
    },
    async put(req, res) {
      const ttl = Number((res.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 0);
      store.set(req.url, { body: await res.arrayBuffer(), status: res.status,
        headers: Object.fromEntries(res.headers), expires: Date.now() + ttl * 1000 });
      while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
    }
  }
};

const port = Number(process.env.PORT || 10000);
http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const url = `http://${req.headers.host || 'localhost'}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const request = new Request(url, {
      method: req.method, headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks)
    });
    const pending = [];
    const r = await handler.fetch(request, process.env, { waitUntil: p => pending.push(p) });
    const out = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(out);
    await Promise.allSettled(pending);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal' }));
  }
}).listen(port, () => console.log('Guillermo sintético API en el puerto ' + port));
