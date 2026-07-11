"use strict";

/**
 * Service worker ATLAS H-ELIA.
 *
 * Objectif principal :
 * - toujours utiliser la dernière version disponible en ligne ;
 * - conserver la dernière version valide pour le mode hors ligne.
 *
 * Stratégies :
 * - navigation et fichiers locaux : réseau frais en priorité ;
 * - modèle Teachable Machine : réseau frais en priorité ;
 * - bibliothèques externes : réseau en priorité ;
 * - cache uniquement comme solution de secours hors ligne.
 */

const CACHE_VERSION =
  "v3";

const CACHE_PREFIX =
  "atlas-h-elia";

const APP_CACHE_NAME =
  `${CACHE_PREFIX}-app-${CACHE_VERSION}`;

const MODEL_CACHE_NAME =
  `${CACHE_PREFIX}-model-${CACHE_VERSION}`;

const RUNTIME_CACHE_NAME =
  `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;

/**
 * Page utilisée comme solution de secours
 * pour une navigation hors ligne.
 */
const OFFLINE_FALLBACK_PATH =
  "./index.html";

/**
 * Fichiers locaux nécessaires au fonctionnement
 * de l’application.
 *
 * Ils sont placés dans le cache lors de l’installation,
 * mais sont toujours vérifiés sur le réseau lorsque
 * l’appareil est connecté.
 */
const APP_ASSETS =
  Object.freeze([
    "./",
    "./index.html",
    "./style.css",

    "./manifest.json",

    "./icon-192.png",
    "./icon-512.png",
    "./icon-512-maskable.png",

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

    "./pwa.js",
  ]);

/**
 * Hôtes externes pouvant être conservés
 * comme secours hors ligne.
 */
const CACHEABLE_EXTERNAL_HOSTS =
  new Set([
    "cdn.jsdelivr.net",
    "teachablemachine.withgoogle.com",
    "storage.googleapis.com",
  ]);

/**
 * Hôtes susceptibles de distribuer les fichiers
 * d’un modèle Teachable Machine.
 */
const MODEL_HOSTS =
  new Set([
    "teachablemachine.withgoogle.com",
    "storage.googleapis.com",
  ]);

/**
 * Installation.
 */
self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      installApplication()
    );
  }
);

/**
 * Activation.
 */
self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      activateApplication()
    );
  }
);

/**
 * Interception des requêtes.
 */
self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !==
      "GET"
    ) {
      return;
    }

    const requestUrl =
      new URL(
        request.url
      );

    /**
     * Les navigations utilisent toujours
     * la page la plus récente disponible.
     */
    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        networkFirstFresh(
          request,
          APP_CACHE_NAME,
          {
            navigation:
              true,
          }
        )
      );

      return;
    }

    /**
     * Les fichiers du modèle doivent toujours
     * être vérifiés sur le serveur.
     */
    if (
      isModelRequest(
        requestUrl
      )
    ) {
      event.respondWith(
        networkFirstFresh(
          request,
          MODEL_CACHE_NAME
        )
      );

      return;
    }

    /**
     * Tous les fichiers locaux utilisent
     * également le réseau frais en priorité.
     *
     * Cela concerne notamment config.js.
     */
    if (
      requestUrl.origin ===
      self.location.origin
    ) {
      event.respondWith(
        networkFirstFresh(
          request,
          APP_CACHE_NAME
        )
      );

      return;
    }

    /**
     * Les bibliothèques externes versionnées
     * sont chargées depuis le réseau, puis
     * conservées comme secours hors ligne.
     */
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
 * Installe une première copie locale
 * des fichiers essentiels.
 */
async function installApplication() {
  const cache =
    await caches.open(
      APP_CACHE_NAME
    );

  const results =
    await Promise.allSettled(
      APP_ASSETS.map(
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

  const failures =
    results
      .map(
        (
          result,
          index
        ) => ({
          asset:
            APP_ASSETS[
              index
            ],

          result,
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
    failures.length > 0
  ) {
    console.warn(
      "Certains fichiers H-ELIA n’ont pas pu être ajoutés au cache initial.",
      failures.map(
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

  /**
   * La nouvelle version devient active
   * sans attendre la fermeture de tous les onglets.
   */
  await self.skipWaiting();
}

/**
 * Active le nouveau service worker
 * et supprime les anciennes versions.
 */
async function activateApplication() {
  const activeCacheNames =
    new Set([
      APP_CACHE_NAME,
      MODEL_CACHE_NAME,
      RUNTIME_CACHE_NAME,
    ]);

  const existingCacheNames =
    await caches.keys();

  await Promise.all(
    existingCacheNames.map(
      (cacheName) => {
        const isHeliaCache =
          cacheName.startsWith(
            `${CACHE_PREFIX}-`
          );

        if (
          isHeliaCache &&
          !activeCacheNames.has(
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

  /**
   * Le service worker prend immédiatement
   * le contrôle des pages ouvertes.
   */
  await self.clients.claim();
}

/**
 * Indique si une URL correspond à un fichier
 * de modèle Teachable Machine.
 *
 * @param {URL} requestUrl
 * URL analysée.
 *
 * @returns {boolean}
 */
function isModelRequest(
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
      "/weights.bin"
    ) ||
    pathname.endsWith(
      ".bin"
    )
  );
}

/**
 * Charge une ressource sans consulter
 * le cache HTTP classique du navigateur.
 *
 * @param {Request} request
 * Requête originale.
 *
 * @returns {Promise<Response>}
 */
async function fetchFresh(
  request
) {
  const freshRequest =
    new Request(
      request,
      {
        cache:
          "no-store",
      }
    );

  return fetch(
    freshRequest
  );
}

/**
 * Stratégie principale :
 *
 * 1. demande toujours la dernière version au serveur ;
 * 2. remplace la copie Cache Storage si la réponse est valide ;
 * 3. utilise la dernière copie valide lorsque le réseau échoue.
 *
 * @param {Request} request
 * Requête.
 *
 * @param {string} cacheName
 * Cache utilisé comme secours.
 *
 * @param {Object} options
 * Options.
 *
 * @param {boolean} options.navigation
 * Indique une navigation HTML.
 *
 * @returns {Promise<Response>}
 */
async function networkFirstFresh(
  request,
  cacheName,
  {
    navigation = false,
  } = {}
) {
  const cache =
    await caches.open(
      cacheName
    );

  try {
    const response =
      await fetchFresh(
        request
      );

    if (
      !isCacheableResponse(
        response
      )
    ) {
      throw new Error(
        `Réponse réseau non exploitable : ${response.status} pour ${request.url}`
      );
    }

    await cache.put(
      request,
      response.clone()
    );

    /**
     * Une navigation valide actualise également
     * la copie générique d’index.html.
     */
    if (navigation) {
      await cache.put(
        OFFLINE_FALLBACK_PATH,
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
      console.warn(
        `Réseau indisponible pour ${request.url}. Utilisation de la dernière copie valide.`,
        error
      );

      return cachedResponse;
    }

    if (navigation) {
      const fallbackResponse =
        await caches.match(
          OFFLINE_FALLBACK_PATH
        ) ||
        await caches.match(
          "./"
        );

      if (fallbackResponse) {
        console.warn(
          "Navigation hors ligne : utilisation de la dernière page H-ELIA disponible.",
          error
        );

        return fallbackResponse;
      }

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

    console.error(
      `La ressource ${request.url} est indisponible et aucune copie locale n’existe.`,
      error
    );

    return Response.error();
  }
}

/**
 * Stratégie réseau en priorité pour les bibliothèques
 * externes versionnées.
 *
 * @param {Request} request
 * Requête.
 *
 * @param {string} cacheName
 * Cache de secours.
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
      !isCacheableResponse(
        response
      )
    ) {
      throw new Error(
        `Réponse externe non exploitable : ${response.status} pour ${request.url}`
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
        `Ressource externe indisponible : ${request.url}. Utilisation du cache.`,
        error
      );

      return cachedResponse;
    }

    console.error(
      `La ressource externe ${request.url} est indisponible sans copie locale.`,
      error
    );

    return Response.error();
  }
}

/**
 * Vérifie qu’une réponse HTTP peut être conservée.
 *
 * @param {Response|null} response
 * Réponse.
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
 * Page minimale affichée lorsqu’aucune version
 * de l’application n’est disponible.
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
      content="width=device-width, initial-scale=1, viewport-fit=cover"
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

      h1 {
        margin-top: 0;
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
        L’application et son modèle ne sont pas accessibles
        sur le réseau actuellement.
      </p>

      <p>
        Aucune copie hors ligne valide n’est encore disponible
        sur cet appareil.
      </p>
    </main>
  </body>
</html>`;
}
