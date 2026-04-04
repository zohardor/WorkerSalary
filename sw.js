// sw.js – Service Worker for Shakaron PWA
// אסטרטגיה: network-first לקבצי האפליקציה, cache-first למשאבים חיצוניים

const CACHE_NAME = 'shakaron-v2.0';

// קבצי האפליקציה — תמיד נטען מהרשת, cache כגיבוי בלבד
const APP_FILES = [
  './',
  './index.html',
  './app.js',
  './holidays.js',
  './manifest.json',
  './supabase/supabase.js',
];

// משאבים חיצוניים — cache-first (לא משתנים)
const EXTERNAL_FILES = [
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(EXTERNAL_FILES).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isAppFile = APP_FILES.some(f => e.request.url.includes(f.replace('./', '')));
  const isLocal   = url.origin === self.location.origin;

  // קבצי האפליקציה — network-first
  if (isLocal && isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Supabase API — תמיד מהרשת, לא מ-cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // משאבים חיצוניים — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
