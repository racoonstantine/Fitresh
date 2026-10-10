/* Fitresh service worker: keeps the app shell available offline.
 *  - index.html: network first (it carries the ?v=<hash> asset URLs), cached copy when offline.
 *  - css/js/icons stamped ?v=<hash> by the deploy: cache first (the URL changes when the file does).
 *  - anything else same-origin and unstamped (images, manifest): stale-while-revalidate.
 *  - /api/ is never touched here; the app queues its own writes and keeps its own read copies.
 */
const SHELL = 'fitresh-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      // Cache the page and every local asset it references, so the very first offline launch works.
      const res = await fetch('index.html', {cache: 'reload'});
      const html = await res.clone().text();
      await cache.put(shellKey(), res);
      const urls = new Set(['manifest.json']);
      const re = /(?:src|href)="([^"#]+\.(?:js|css|png|svg))(\?[^"]*)?"/g;
      let m;
      while ((m = re.exec(html))) {
        if (/^(?:[a-z]+:)?\/\//i.test(m[1])) continue;
        urls.add(m[1] + (m[2] || ''));
      }
      await Promise.all([...urls].map(u => cache.add(new Request(u, {cache: 'reload'})).catch(() => {})));
    } catch (e) { /* offline during install: runtime caching will fill in later */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== SHELL) await caches.delete(key);
    await self.clients.claim();
  })());
});

function shellKey() { return new URL('index.html', self.registration.scope).href; }

// Drop older ?v= copies of the same file so the cache doesn't grow with every deploy.
async function putAsset(cache, request, response) {
  const url = new URL(request.url);
  if (url.searchParams.has('v')) {
    for (const old of await cache.keys()) {
      const o = new URL(old.url);
      if (o.pathname === url.pathname && o.search !== url.search) await cache.delete(old);
    }
  }
  await cache.put(request, response);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\/api\//.test(url.pathname) || /\/sw\.js$/.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await fetch(req);
        if (res.ok && /\/(?:index\.html)?$/.test(url.pathname)) cache.put(shellKey(), res.clone());
        return res;
      } catch (e) {
        const cached = await cache.match(shellKey());
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  if (!/\.(?:js|css|png|svg|json|ico|webp|woff2?)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const cached = await cache.match(req);
    if (cached && url.searchParams.has('v')) return cached;
    const network = fetch(req).then(async (res) => {
      if (res.ok) await putAsset(cache, req, res.clone());
      return res;
    });
    if (cached) { network.catch(() => {}); return cached; }
    return network;
  })());
});
