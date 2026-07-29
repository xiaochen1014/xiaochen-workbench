/* 小陈的工作台 — Service Worker（PWA 离线缓存） */
const CACHE = 'xc-workbench-v2';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/style.css',
  'assets/store.js',
  'assets/app.js',
  'assets/sections/exam.js',
  'assets/sections/health.js',
  'assets/sections/savings.js',
  'assets/sections/travel.js',
  'assets/sections/goals.js',
  'assets/sections/review.js',
  'assets/vendor/echarts.min.js',
  'assets/vendor/geo/100000_full.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 同源静态资源：缓存优先，同时后台更新
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // 跨域（地图边界 / ECharts CDN 等）：网络优先，失败回退缓存
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
