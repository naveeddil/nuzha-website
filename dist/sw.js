// Offline support for the menu app (installed from menu.html / packaged as an Android APK).
// Pages, scripts and saved content: network first, cached copy when offline, so updates appear as soon as the tablet is online.
// Images and fonts: cached copy first (refreshed in the background). The admin portal and other API calls are never cached.
// Bump VERSION whenever this file changes.
const VERSION = "nuzha-menu-v1";
const CORE = ["menu.html", "menu.js", "menu-order.js", "menu-data.js", "runtime-content.js", "seo.js", "styles.css", "menu.css", "menu-flags.css",
  "menu-restaurant-images.json", "menu-open-images.json", "manifest.webmanifest", "assets/logo.png", "assets/app-icon-192.png", "assets/gallery-hero-night.jpg"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    // Pre-load every dish photo so the whole menu works without Wi-Fi.
    try {
      const map = await (await fetch("menu-restaurant-images.json")).json();
      await Promise.allSettled([...new Set(Object.values(map))].map(src => cache.add(src)));
    } catch {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

const networkFirst = async request => {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, {ignoreSearch: request.mode === "navigate"});
    if (cached) return cached;
    throw error;
  }
};

const cacheFirst = async request => {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(response => { if (response.ok || response.type === "opaque") cache.put(request, response.clone()); return response; }).catch(() => cached);
  return cached || refresh;
};

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !fonts) return;
  if (url.pathname.includes("/admin/")) return;
  if (url.pathname.includes("/api/") && !url.pathname.endsWith("/api/content.php")) return;
  if (fonts || /\.(jpe?g|png|webp|svg|gif)$/i.test(url.pathname)) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});
