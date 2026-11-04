"use strict";

/**
 * Service worker ATLAS H-ELIA.
 *
 * - réseau en priorité : la dernière version en ligne est toujours utilisée ;
 * - cache en secours : l'application fonctionne hors ligne sur le terrain ;
 * - les anciens caches (dont ceux de la version IA) sont supprimés.
 */

const CACHE_VERSION = "v7";
const CACHE_PREFIX = "atlas-h-elia";
const APP_CACHE_NAME = `${CACHE_PREFIX}-app-${CACHE_VERSION}`;
const OFFLINE_FALLBACK_PATH = "./index.html";

const APP_ASSETS = Object.freeze([
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./jsQR.js",
  "./config.js",
  "./store.js",
  "./reference.js",
  "./scanner.js",
  "./export.js",
  "./app.js",
  "./pwa.js",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE_NAME);

      await Promise.all(
        APP_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(new Request(asset, { cache: "reload" }));
            if (response.ok) {
              await cache.put(asset, response);
            }
          } catch (error) {
            console.warn(`Mise en cache impossible : ${asset}`, error);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== APP_CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });

    if (cached) {
      return cached;
    }

    if (request.mode === "navigate") {
      const fallback = await cache.match(OFFLINE_FALLBACK_PATH);
      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}
