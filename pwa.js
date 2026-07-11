"use strict";

/**
 * Gestion PWA d’ATLAS H-ELIA.
 *
 * Ce module :
 * - enregistre le service worker ;
 * - vérifie les mises à jour à chaque ouverture ;
 * - active automatiquement la nouvelle version ;
 * - évite les rechargements en boucle.
 */
window.HeliaPwa = (() => {
  const SERVICE_WORKER_PATH =
    "./sw.js";

  let registration = null;
  let hasReloaded = false;

  /**
   * Vérifie si les service workers
   * sont disponibles dans le navigateur.
   *
   * @returns {boolean}
   */
  function isSupported() {
    return (
      "serviceWorker" in
      navigator
    );
  }

  /**
   * Enregistre le service worker.
   *
   * @returns {Promise<ServiceWorkerRegistration|null>}
   */
  async function register() {
    if (!isSupported()) {
      console.info(
        "Les service workers ne sont pas pris en charge par ce navigateur."
      );

      return null;
    }

    try {
      registration =
        await navigator
          .serviceWorker
          .register(
            SERVICE_WORKER_PATH,
            {
              scope:
                "./",

              updateViaCache:
                "none",
            }
          );

      listenForUpdates(
        registration
      );

      await registration.update();

      return registration;
    } catch (error) {
      console.warn(
        "Le service worker H-ELIA n’a pas pu être enregistré.",
        error
      );

      return null;
    }
  }

  /**
   * Surveille l’arrivée d’une nouvelle version.
   *
   * @param {ServiceWorkerRegistration} currentRegistration
   * Enregistrement actif.
   */
  function listenForUpdates(
    currentRegistration
  ) {
    currentRegistration
      .addEventListener(
        "updatefound",
        () => {
          const installingWorker =
            currentRegistration
              .installing;

          if (!installingWorker) {
            return;
          }

          installingWorker
            .addEventListener(
              "statechange",
              () => {
                if (
                  installingWorker
                    .state ===
                    "installed" &&
                  navigator
                    .serviceWorker
                    .controller
                ) {
                  console.info(
                    "Une nouvelle version de H-ELIA est prête."
                  );
                }
              }
            );
        }
      );
  }

  /**
   * Recharge l’application une seule fois
   * lorsqu’un nouveau service worker prend le contrôle.
   */
  function listenForControllerChange() {
    if (!isSupported()) {
      return;
    }

    navigator
      .serviceWorker
      .addEventListener(
        "controllerchange",
        () => {
          if (hasReloaded) {
            return;
          }

          hasReloaded =
            true;

          window.location.reload();
        }
      );
  }

  /**
   * Démarre la gestion PWA.
   */
  async function initialize() {
    listenForControllerChange();

    await register();
  }

  /**
   * Retourne l’enregistrement actuel.
   *
   * @returns {ServiceWorkerRegistration|null}
   */
  function getRegistration() {
    return registration;
  }

  /**
   * Démarrage automatique.
   */
  function start() {
    initialize().catch(
      (error) => {
        console.error(
          "La gestion PWA H-ELIA n’a pas pu démarrer.",
          error
        );
      }
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true,
      }
    );
  } else {
    window.queueMicrotask(
      start
    );
  }

  return Object.freeze({
    initialize,
    register,
    getRegistration,
    isSupported,
  });
})();