"use strict";

/**
 * Service worker ATLAS H-ELIA.
 *
 * Stratégies :
 * - navigation : réseau en priorité, cache en secours ;
 * - fichiers locaux : cache immédiat, actualisation en arrière-plan ;
 * - modèle Teachable Machine : réseau forcé sans cache HTTP,
 *   puis remplacement de la copie hors ligne ;
 * - autres bibliothèques externes : réseau en priorité,
 *   cache en secours.
 */

const CACHE_VERSION = "v2";

const STATIC_CACHE_NAME =
  `atlas-h-elia-static-${CACHE_VERSION}`;

const RUNTIME_CACHE_NAME =
  `atlas-h-elia-runtime-${CACHE_VERSION}`;

const MODEL_CACHE_NAME =
  `atlas-h-elia-model-${CACHE_VERSION}`;

/**
 * Fichiers essentiels de l'application.
 *
 * Les icônes seront ajoutées lorsque leurs fichiers
 * auront été créés.
 */
const STATIC_ASSETS = Object.freeze([
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",

  "./config.js",
  "./navigation.js",
  "./camera.js",
  "./ai.js",
  "./inventaire.js",

  "./manual.js",

  "./home.js",
  "./identification.js",
  "./scan.js",
  "./summary-design.js",

  "./export.js",
  "./share.js",
  "./share-ui.js",

  "./ui.js",
  "./sketch.js",
]);

/**
 * Hôtes externes autorisés dans le cache d'exécution.
 */
const CACHEABLE_EXTERNAL_HOSTS =
  new Set([
    "cdn.jsdelivr.net",
    "teachablemachine.withgoogle.com",
    "storage.googleapis.com",
  ]);

/**
 * Hôtes utilisés par les modèles Teachable Machine.
 */
const MODEL_HOSTS =
  new Set([
    "teachablemachine.withgoogle.com",
    "storage.googleapis.com",
  ]);

/**
 * Installation du service worker.
 */
self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      installApplicationCache()
    );
  }
);

/**
 * Activation et suppression des anciens caches.
 */
self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      activateServiceWorker()
    );
  }
);

/**
 * Interception des requêtes HTTP GET.
 */
self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const requestUrl =
      new URL(
        request.url
      );

    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        handleNavigationRequest(
          request
        )
      );

      return;
    }

    if (
      isTeachableMachineModelRequest(
        requestUrl
      )
    ) {
      event.respondWith(
        refreshModelAsset(
          request
        )
      );

      return;
    }

    if (
      requestUrl.origin ===
      self.location.origin
    ) {
      event.respondWith(
        staleWhileRevalidate(
          request,
          STATIC_CACHE_NAME
        )
      );

      return;
    }

    if (
      CACHEABLE_EXTERNAL_HOSTS.has(
        requestUrl.hostname
      )
    ) {
      event.respondWith(
        networkFirst(
          request,
          RUNTIME_CACHE_NAME
        )
      );
    }
  }
);

/**
 * Prépare le cache initial.
 */
async function installApplicationCache() {
  const cache =
    await caches.open(
      STATIC_CACHE_NAME
    );

  const results =
    await Promise.allSettled(
      STATIC_ASSETS.map(
        async (assetPath) => {
          const request =
            new Request(
              assetPath,
              {
                cache:
                  "reload",
              }
            );

          const response =
            await fetch(
              request
            );

          if (
            !isCacheableResponse(
              response
            )
          ) {
            throw new Error(
              `Réponse non exploitable pour ${assetPath}.`
            );
          }

          await cache.put(
            request,
            response.clone()
          );
        }
      )
    );

  const failedAssets =
    results
      .map(
        (
          result,
          index
        ) => ({
          result,
          asset:
            STATIC_ASSETS[
              index
            ],
        })
      )
      .filter(
        ({
          result,
        }) =>
          result.status ===
          "rejected"
      );

  if (
    failedAssets.length > 0
  ) {
    console.warn(
      "Certains fichiers H-ELIA n'ont pas pu être placés dans le cache initial :",
      failedAssets.map(
        ({
          asset,
          result,
        }) => ({
          asset,
          error:
            result.reason,
        })
      )
    );
  }

  await self.skipWaiting();
}

/**
 * Active le service worker et supprime
 * les anciennes versions des caches H-ELIA.
 */
async function activateServiceWorker() {
  const currentCaches =
    new Set([
      STATIC_CACHE_NAME,
      RUNTIME_CACHE_NAME,
      MODEL_CACHE_NAME,
    ]);

  const cacheNames =
    await caches.keys();

  await Promise.all(
    cacheNames.map(
      (cacheName) => {
        const isHeliaCache =
          cacheName.startsWith(
            "atlas-h-elia-"
          );

        if (
          isHeliaCache &&
          !currentCaches.has(
            cacheName
          )
        ) {
          return caches.delete(
            cacheName
          );
        }

        return Promise.resolve(
          false
        );
      }
    )
  );

  await self.clients.claim();
}

/**
 * Vérifie si une requête correspond à un fichier
 * de modèle Teachable Machine.
 *
 * Les fichiers généralement chargés sont :
 * - model.json ;
 * - metadata.json ;
 * - weights.bin.
 *
 * @param {URL} requestUrl
 * URL de la requête.
 *
 * @returns {boolean}
 */
function isTeachableMachineModelRequest(
  requestUrl
) {
  if (
    !MODEL_HOSTS.has(
      requestUrl.hostname
    )
  ) {
    return false;
  }

  const pathname =
    requestUrl.pathname
      .toLowerCase();

  return (
    pathname.endsWith(
      "/model.json"
    ) ||
    pathname.endsWith(
      "/metadata.json"
    ) ||
    pathname.endsWith(
      ".bin"
    )
  );
}

/**
 * Charge toujours la dernière version disponible
 * d'un fichier du modèle.
 *
 * Le cache HTTP classique du navigateur est contourné
 * grâce à cache: "no-store".
 *
 * Si le réseau fonctionne :
 * - la dernière ressource distante est retournée ;
 * - la copie hors ligne est remplacée.
 *
 * Si le réseau échoue :
 * - la dernière copie valide du modèle est utilisée.
 *
 * @param {Request} request
 * Requête originale.
 *
 * @returns {Promise<Response>}
 */
async function refreshModelAsset(
  request
) {
  const cache =
    await caches.open(
      MODEL_CACHE_NAME
    );

  try {
    const freshRequest =
      new Request(
        request,
        {
          cache:
            "no-store",
        }
      );

    const response =
      await fetch(
        freshRequest
      );

    if (
      !isCacheableResponse(
        response
      )
    ) {
      throw new Error(
        `Réponse non exploitable pour le modèle : ${request.url}`
      );
    }

    await cache.put(
      request,
      response.clone()
    );

    return response;
  } catch (error) {
    const cachedResponse =
      await cache.match(
        request
      );

    if (cachedResponse) {
      console.warn(
        `Le dernier modèle distant est indisponible. Utilisation de la copie hors ligne pour ${request.url}.`,
        error
      );

      return cachedResponse;
    }

    console.error(
      `Le fichier du modèle ${request.url} est indisponible et aucune copie hors ligne n'existe.`,
      error
    );

    return Response.error();
  }
}

/**
 * Navigation :
 * tente d'abord le réseau, puis charge
 * l'application mise en cache.
 *
 * @param {Request} request
 * Requête de navigation.
 *
 * @returns {Promise<Response>}
 */
async function handleNavigationRequest(
  request
) {
  try {
    const response =
      await fetch(
        new Request(
          request,
          {
            cache:
              "no-cache",
          }
        )
      );

    if (
      isCacheableResponse(
        response
      )
    ) {
      const cache =
        await caches.open(
          STATIC_CACHE_NAME
        );

      await cache.put(
        "./index.html",
        response.clone()
      );
    }

    return response;
  } catch (error) {
    const cachedPage =
      await caches.match(
        "./index.html"
      ) ||
      await caches.match(
        "./"
      );

    if (cachedPage) {
      return cachedPage;
    }

    console.error(
      "La page H-ELIA n'est disponible ni sur le réseau ni dans le cache.",
      error
    );

    return new Response(
      createOfflineDocument(),
      {
        status:
          503,

        statusText:
          "Service indisponible",

        headers: {
          "Content-Type":
            "text/html; charset=utf-8",
        },
      }
    );
  }
}

/**
 * Retourne rapidement la version en cache,
 * puis actualise le fichier en arrière-plan.
 *
 * @param {Request} request
 * Requête.
 *
 * @param {string} cacheName
 * Nom du cache.
 *
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(
  request,
  cacheName
) {
  const cache =
    await caches.open(
      cacheName
    );

  const cachedResponse =
    await cache.match(
      request
    );

  const networkPromise =
    fetch(
      request
    )
      .then(
        async (response) => {
          if (
            isCacheableResponse(
              response
            )
          ) {
            await cache.put(
              request,
              response.clone()
            );
          }

          return response;
        }
      )
      .catch(
        (error) => {
          console.warn(
            `Actualisation impossible pour ${request.url}.`,
            error
          );

          return null;
        }
      );

  if (cachedResponse) {
    void networkPromise;

    return cachedResponse;
  }

  const networkResponse =
    await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  return Response.error();
}

/**
 * Tente d'abord le réseau.
 * Utilise le cache lorsque le réseau échoue.
 *
 * @param {Request} request
 * Requête.
 *
 * @param {string} cacheName
 * Nom du cache.
 *
 * @returns {Promise<Response>}
 */
async function networkFirst(
  request,
  cacheName
) {
  const cache =
    await caches.open(
      cacheName
    );

  try {
    const response =
      await fetch(
        request
      );

    if (
      isCacheableResponse(
        response
      )
    ) {
      await cache.put(
        request,
        response.clone()
      );
    }

    return response;
  } catch (error) {
    const cachedResponse =
      await cache.match(
        request
      );

    if (cachedResponse) {
      return cachedResponse;
    }

    console.warn(
      `La ressource externe ${request.url} est indisponible.`,
      error
    );

    return Response.error();
  }
}

/**
 * Vérifie qu'une réponse peut être mise en cache.
 *
 * Les réponses opaques sont autorisées pour
 * certaines ressources externes.
 *
 * @param {Response|null} response
 * Réponse HTTP.
 *
 * @returns {boolean}
 */
function isCacheableResponse(
  response
) {
  return Boolean(
    response &&
    (
      response.ok ||
      response.type ===
        "opaque"
    )
  );
}

/**
 * Produit une page minimale en cas
 * d'indisponibilité totale.
 *
 * @returns {string}
 */
function createOfflineDocument() {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <meta
      name="theme-color"
      content="#044550"
    />

    <title>ATLAS H-ELIA — Hors ligne</title>

    <style>
      :root {
        color-scheme: dark;

        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      body {
        display: grid;
        place-items: center;

        min-height: 100vh;
        min-height: 100dvh;

        margin: 0;
        padding: 24px;

        color: #f4ffff;

        background:
          radial-gradient(
            circle at top,
            #06444d,
            #001217 65%
          );
      }

      main {
        width:
          min(
            100%,
            480px
          );

        padding: 28px;

        border:
          1px solid
          rgb(55 221 212 / 30%);

        border-radius: 20px;

        background:
          rgb(3 38 45 / 85%);

        box-shadow:
          0 20px 50px
          rgb(0 0 0 / 35%);
      }

      p {
        color: #d8eaec;

        line-height: 1.6;
      }
    </style>
  </head>

  <body>
    <main>
      <h1>ATLAS H-ELIA</h1>

      <p>
        L'application n'est pas encore disponible hors ligne
        sur cet appareil.
      </p>

      <p>
        Rétablissez la connexion, puis rechargez la page
        afin de terminer son installation.
      </p>
    </main>
  </body>
</html>`;
}