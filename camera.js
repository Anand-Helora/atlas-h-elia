"use strict";

/**
 * Gestion indépendante de la caméra.
 *
 * Cette version protège notamment contre :
 * - plusieurs démarrages simultanés ;
 * - les flux créés après un arrêt demandé ;
 * - les anciens éléments vidéo encore attachés ;
 * - les pistes interrompues par le navigateur.
 */
window.HeliaCamera = (() => {
  const CAMERA_STATUS = Object.freeze({
    IDLE: "idle",
    STARTING: "starting",
    ACTIVE: "active",
    ERROR: "error",
  });

  let mediaStream = null;
  let attachedVideoElement = null;

  let status = CAMERA_STATUS.IDLE;
  let lastError = null;

  /*
   * Une seule demande de caméra peut être active à la fois.
   */
  let startPromise = null;

  /*
   * Chaque arrêt invalide les demandes de caméra précédentes.
   * Cela évite qu'un ancien getUserMedia() réactive la caméra
   * après avoir quitté l'écran.
   */
  let startGeneration = 0;

  /**
   * Vérifie si le navigateur prend en charge la caméra.
   *
   * @returns {boolean}
   */
  function isSupported() {
    return Boolean(
      navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia ===
          "function"
    );
  }

  /**
   * Démarre la caméra.
   *
   * Si une demande est déjà en cours, elle est réutilisée
   * plutôt que d'ouvrir un second flux vidéo.
   *
   * @param {HTMLVideoElement|null} videoElement Élément vidéo facultatif.
   * @returns {Promise<Object>}
   */
  async function start(videoElement = null) {
    lastError = null;

    validateCameraAvailability();

    if (hasActiveStream()) {
      status = CAMERA_STATUS.ACTIVE;

      if (videoElement) {
        await attachTo(videoElement);
      }

      return getSnapshot();
    }

    if (!startPromise) {
      const generation =
        ++startGeneration;

      status =
        CAMERA_STATUS.STARTING;

      const pendingPromise =
        createCameraStream(
          generation
        );

      startPromise =
        pendingPromise;

      pendingPromise.finally(
        () => {
          if (
            startPromise ===
            pendingPromise
          ) {
            startPromise = null;
          }
        }
      );
    }

    try {
      await startPromise;

      if (!hasActiveStream()) {
        throw createCameraError(
          "CAMERA_START_CANCELLED",
          "Le démarrage de la caméra a été interrompu."
        );
      }

      status =
        CAMERA_STATUS.ACTIVE;

      if (videoElement) {
        await attachTo(
          videoElement
        );
      }

      return getSnapshot();
    } catch (originalError) {
      if (
        originalError?.code ===
        "CAMERA_START_CANCELLED"
      ) {
        status =
          CAMERA_STATUS.IDLE;

        lastError = null;

        throw originalError;
      }

      /*
       * Les éventuelles pistes déjà créées sont arrêtées
       * avant de transformer l'erreur.
       */
      releaseMediaStream();

      const normalizedError =
        normalizeCameraError(
          originalError
        );

      status =
        CAMERA_STATUS.ERROR;

      lastError =
        normalizedError;

      throw normalizedError;
    }
  }

  /**
   * Valide les conditions nécessaires à la caméra.
   */
  function validateCameraAvailability() {
    if (!isSupported()) {
      const error =
        createCameraError(
          "UNSUPPORTED_BROWSER",
          "Ce navigateur ne permet pas d'utiliser la caméra."
        );

      status =
        CAMERA_STATUS.ERROR;

      lastError = error;

      throw error;
    }

    if (
      !window.isSecureContext &&
      window.location.hostname !==
        "localhost"
    ) {
      const error =
        createCameraError(
          "INSECURE_CONTEXT",
          "La caméra nécessite une connexion sécurisée HTTPS."
        );

      status =
        CAMERA_STATUS.ERROR;

      lastError = error;

      throw error;
    }
  }

  /**
   * Crée réellement le flux vidéo.
   *
   * @param {number} generation Génération du démarrage.
   * @returns {Promise<void>}
   */
  async function createCameraStream(
    generation
  ) {
    const requestedStream =
      await requestPreferredCamera();

    /*
     * L'utilisateur a quitté l'écran ou a demandé un arrêt
     * pendant que getUserMedia() attendait une réponse.
     */
    if (
      generation !==
      startGeneration
    ) {
      stopStreamTracks(
        requestedStream
      );

      throw createCameraError(
        "CAMERA_START_CANCELLED",
        "Le démarrage de la caméra a été interrompu."
      );
    }

    replaceMediaStream(
      requestedStream
    );

    status =
      CAMERA_STATUS.ACTIVE;
  }

  /**
   * Demande en priorité la caméra arrière.
   *
   * @returns {Promise<MediaStream>}
   */
  async function requestPreferredCamera() {
    const cameraConfig =
      window.HELIA_CONFIG
        ?.camera ?? {};

    const facingMode =
      cameraConfig
        .preferredFacingMode ||
      "environment";

    const preferredWidth =
      Number(
        cameraConfig.preferredWidth
      ) || 1280;

    const preferredHeight =
      Number(
        cameraConfig.preferredHeight
      ) || 720;

    const preferredFrameRate =
      Number(
        cameraConfig.preferredFrameRate
      ) || 30;

    const constraints = {
      audio: false,

      video: {
        facingMode: {
          ideal: facingMode,
        },

        width: {
          ideal: preferredWidth,
        },

        height: {
          ideal: preferredHeight,
        },

        frameRate: {
          ideal:
            preferredFrameRate,

          max:
            preferredFrameRate,
        },
      },
    };

    try {
      return await navigator
        .mediaDevices
        .getUserMedia(
          constraints
        );
    } catch (firstError) {
      if (
        firstError?.name ===
          "OverconstrainedError" ||
        firstError?.name ===
          "ConstraintNotSatisfiedError"
      ) {
        return navigator
          .mediaDevices
          .getUserMedia({
            audio: false,
            video: true,
          });
      }

      throw firstError;
    }
  }

  /**
   * Remplace le flux actuellement utilisé.
   *
   * @param {MediaStream} newStream Nouveau flux.
   */
  function replaceMediaStream(
    newStream
  ) {
    if (
      mediaStream &&
      mediaStream !== newStream
    ) {
      stopStreamTracks(
        mediaStream
      );
    }

    mediaStream =
      newStream;

    monitorStreamTracks(
      newStream
    );
  }

  /**
   * Surveille les pistes de la caméra.
   *
   * Le navigateur ou le système peut arrêter une caméra
   * sans que l'application appelle stop().
   *
   * @param {MediaStream} stream Flux vidéo.
   */
  function monitorStreamTracks(
    stream
  ) {
    stream
      .getTracks()
      .forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            handleTrackEnded(
              stream
            );
          },
          {
            once: true,
          }
        );
      });
  }

  /**
   * Réagit à l'arrêt externe d'une piste.
   *
   * @param {MediaStream} stream Flux concerné.
   */
  function handleTrackEnded(
    stream
  ) {
    if (
      stream !== mediaStream
    ) {
      return;
    }

    if (
      stream
        .getTracks()
        .some(
          (track) =>
            track.readyState ===
            "live"
        )
    ) {
      return;
    }

    detachCurrentVideoElement();

    mediaStream = null;

    if (
      status !==
      CAMERA_STATUS.ERROR
    ) {
      status =
        CAMERA_STATUS.IDLE;
    }
  }

  /**
   * Attache le flux actif à un élément vidéo.
   *
   * @param {HTMLVideoElement} videoElement Élément vidéo.
   * @returns {Promise<void>}
   */
  async function attachTo(
    videoElement
  ) {
    if (
      !videoElement ||
      String(
        videoElement.tagName
      ).toUpperCase() !==
        "VIDEO"
    ) {
      throw createCameraError(
        "INVALID_VIDEO_ELEMENT",
        "L'élément destiné à afficher la caméra n'est pas valide."
      );
    }

    if (!hasActiveStream()) {
      throw createCameraError(
        "NO_ACTIVE_STREAM",
        "Aucun flux vidéo actif n'est disponible."
      );
    }

    /*
     * Évite de détacher et réattacher inutilement
     * le même élément vidéo.
     */
    if (
      attachedVideoElement ===
        videoElement &&
      videoElement.srcObject ===
        mediaStream
    ) {
      if (
        videoElement.paused
      ) {
        await playVideoElement(
          videoElement
        );
      }

      return;
    }

    detachCurrentVideoElement();

    attachedVideoElement =
      videoElement;

    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;

    videoElement.srcObject =
      mediaStream;

    try {
      await playVideoElement(
        videoElement
      );
    } catch (originalError) {
      detachCurrentVideoElement();

      throw createCameraError(
        "VIDEO_PLAYBACK_FAILED",
        "Le navigateur n'a pas pu afficher le flux vidéo.",
        originalError
      );
    }
  }

  /**
   * Lance la lecture d'un élément vidéo.
   *
   * @param {HTMLVideoElement} videoElement Vidéo.
   * @returns {Promise<void>}
   */
  async function playVideoElement(
    videoElement
  ) {
    const playResult =
      videoElement.play();

    if (
      playResult &&
      typeof playResult.then ===
        "function"
    ) {
      await playResult;
    }
  }

  /**
   * Arrête complètement la caméra.
   */
  function stop() {
    /*
     * Invalide aussi une éventuelle demande getUserMedia()
     * qui n'aurait pas encore terminé.
     */
    startGeneration += 1;
    startPromise = null;

    detachCurrentVideoElement();
    releaseMediaStream();

    status =
      CAMERA_STATUS.IDLE;
  }

  /**
   * Arrête et libère le flux actuel.
   */
  function releaseMediaStream() {
    if (mediaStream) {
      stopStreamTracks(
        mediaStream
      );
    }

    mediaStream = null;
  }

  /**
   * Arrête toutes les pistes d'un flux.
   *
   * @param {MediaStream|null} stream Flux.
   */
  function stopStreamTracks(
    stream
  ) {
    if (!stream) {
      return;
    }

    stream
      .getTracks()
      .forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn(
            "Impossible d'arrêter une piste de la caméra :",
            error
          );
        }
      });
  }

  /**
   * Détache l'élément vidéo sans arrêter le flux.
   */
  function detachCurrentVideoElement() {
    const videoElement =
      attachedVideoElement;

    attachedVideoElement = null;

    if (!videoElement) {
      return;
    }

    try {
      videoElement.pause();

      videoElement.srcObject =
        null;

      /*
       * Ces deux opérations aident certains navigateurs
       * à libérer plus rapidement les ressources vidéo.
       */
      videoElement.removeAttribute(
        "src"
      );

      videoElement.load();
    } catch (error) {
      console.warn(
        "Impossible de détacher proprement la vidéo :",
        error
      );
    }
  }

  /**
   * Vérifie si un flux vidéo est actif.
   *
   * @returns {boolean}
   */
  function hasActiveStream() {
    if (!mediaStream) {
      return false;
    }

    return mediaStream
      .getVideoTracks()
      .some(
        (track) =>
          track.readyState ===
          "live" &&
          track.enabled
      );
  }

  /**
   * Retourne l'état de la caméra.
   *
   * @returns {Object}
   */
  function getSnapshot() {
    const videoTrack =
      mediaStream
        ?.getVideoTracks()
        ?.[0] ?? null;

    const settings =
      videoTrack
        ?.getSettings
        ?.() ?? {};

    return {
      status,

      isSupported:
        isSupported(),

      isActive:
        hasActiveStream(),

      isStarting:
        status ===
        CAMERA_STATUS.STARTING,

      facingMode:
        settings.facingMode ||
        null,

      width:
        settings.width ||
        null,

      height:
        settings.height ||
        null,

      frameRate:
        settings.frameRate ||
        null,

      deviceId:
        settings.deviceId ||
        null,

      lastError:
        lastError
          ? {
              name:
                lastError.name,

              code:
                lastError.code,

              message:
                lastError.message,
            }
          : null,
    };
  }

  /**
   * Transforme les erreurs du navigateur en messages lisibles.
   *
   * @param {Error} error Erreur originale.
   * @returns {Error}
   */
  function normalizeCameraError(
    error
  ) {
    if (
      error?.name ===
        "HeliaCameraError" &&
      error?.code
    ) {
      return error;
    }

    const errorName =
      error?.name ||
      "CameraError";

    switch (errorName) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return createCameraError(
          "PERMISSION_DENIED",
          "L'accès à la caméra a été refusé. Autorisez la caméra dans les paramètres du navigateur.",
          error
        );

      case "NotFoundError":
      case "DevicesNotFoundError":
        return createCameraError(
          "NO_CAMERA_FOUND",
          "Aucune caméra compatible n'a été détectée sur cet appareil.",
          error
        );

      case "NotReadableError":
      case "TrackStartError":
        return createCameraError(
          "CAMERA_BUSY",
          "La caméra est déjà utilisée par une autre application ou n'est pas disponible.",
          error
        );

      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return createCameraError(
          "UNSUPPORTED_CONSTRAINTS",
          "La caméra ne prend pas en charge les paramètres demandés.",
          error
        );

      case "SecurityError":
        return createCameraError(
          "SECURITY_ERROR",
          "Le navigateur bloque l'utilisation de la caméra pour des raisons de sécurité.",
          error
        );

      case "AbortError":
        return createCameraError(
          "CAMERA_ABORTED",
          "Le démarrage de la caméra a été interrompu.",
          error
        );

      default:
        return createCameraError(
          "UNKNOWN_CAMERA_ERROR",
          "Une erreur inattendue empêche l'utilisation de la caméra.",
          error
        );
    }
  }

  /**
   * Crée une erreur enrichie.
   *
   * @param {string} code Code fonctionnel.
   * @param {string} message Message utilisateur.
   * @param {Error|null} originalError Erreur originale.
   * @returns {Error}
   */
  function createCameraError(
    code,
    message,
    originalError = null
  ) {
    const error =
      new Error(message);

    error.name =
      "HeliaCameraError";

    error.code = code;

    error.originalError =
      originalError;

    return error;
  }

  /**
   * Arrête la caméra lorsque la page est quittée.
   */
  window.addEventListener(
    "pagehide",
    stop
  );

  return Object.freeze({
    CAMERA_STATUS,

    isSupported,
    start,
    attachTo,
    stop,
    hasActiveStream,
    getSnapshot,
  });
})();