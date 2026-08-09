/* 화면 파일 캐시.
   규정 자료와 PDF는 IndexedDB에 따로 보관되므로 여기서 다루지 않는다.

   방침: 항상 최신 우선(network-first), 네트워크가 안 되면 캐시로 대체.
   갱신한 index.html 이 바로 반영되는 것이 중요하다 —
   반영되지 않으면 각자 Ctrl+Shift+R 을 눌러야 하는데,
   동료들은 그래야 하는 줄 모른다.

   핵심은 cache:'reload' 다. 이것이 없으면 fetch 가 브라우저 자체 HTTP
   캐시에서 옛 파일을 그대로 돌려주어, 네트워크 우선으로 짜도 소용이 없다. */
const V = 'lr-rules-v2';
const SHELL = ['./', './index.html', './mec.csv', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(
        SHELL.map(u => fetch(new Request(u, { cache: 'reload' }))
          .then(r => r.ok && c.put(u, r)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // 외부 요청은 건드리지 않는다

  e.respondWith((async () => {
    try {
      // cache:'reload' 로 브라우저 HTTP 캐시를 건너뛰고 서버에서 직접 받는다
      const fresh = await fetch(new Request(req, { cache: 'reload' }));
      if (fresh && fresh.ok) {
        const c = await caches.open(V);
        c.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      // 네트워크 실패 시에만 캐시 사용
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

/* 페이지에서 갱신 확인을 요청할 수 있게 한다 */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
