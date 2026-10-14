"use strict";

// Bump this value whenever the app shell or its asset list changes.
const CACHE_NAME = "personal-music-player-shell-v10";
const APP_SCOPE = self.registration.scope;
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./songs.json",
  "./manifest.webmanifest",
  "./icons/app-icon.svg?v=2",
  "./icons/app-icon-180.png?v=2",
  "./icons/app-icon-192.png?v=2",
  "./icons/app-icon-512.png?v=2"
].map((path) => new URL(path, APP_SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  // Do not call skipWaiting automatically. The page offers a user-controlled update.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("personal-music-player-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isSongPayload(url) {
  return url.pathname.includes("/audio/") || url.pathname.includes("/covers/") || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(url.pathname);
}

async function networkFirst(request, cacheKey) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(cacheKey, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(APP_SCOPE)) return;

  // Downloaded song and cover blobs belong in IndexedDB, never in Cache Storage.
  if (isSongPayload(url)) return;

  const manifestUrl = new URL("./songs.json", APP_SCOPE).href;
  if (url.href === manifestUrl) {
    event.respondWith(networkFirst(request, manifestUrl));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(new URL("./index.html", APP_SCOPE).href, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return (await caches.match(new URL("./index.html", APP_SCOPE).href)) || Response.error();
      }
    })());
    return;
  }

  if (SHELL_ASSETS.includes(url.href)) {
    event.respondWith((async () => (await caches.match(url.href)) || fetch(request))());
  }
});
