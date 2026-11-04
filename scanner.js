"use strict";

/**
 * Lecture de QR codes avec la caméra.
 *
 * - utilise le lecteur natif du navigateur (BarcodeDetector)
 *   lorsqu'il existe (Chrome Android notamment) ;
 * - sinon, décode les images avec jsQR (Safari iPhone, Firefox…) ;
 * - gère la lampe torche lorsque l'appareil la propose ;
 * - libère toujours la caméra à l'arrêt.
 */
window.HeliaScanner = (() => {
  let stream = null;
  let video = null;
  let canvas = null;
  let context = null;
  let detector = null;
  let timer = null;
  let running = false;
  let generation = 0;
  let torchOn = false;

  function isSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }

  /**
   * Démarre la caméra et la lecture.
   *
   * @param {HTMLVideoElement} videoElement Élément vidéo d'affichage.
   * @param {(value: string) => void} onDetected Appelé une seule fois.
   */
  async function start(videoElement, onDetected) {
    stop();

    if (!isSupported()) {
      throw createError(
        "unsupported",
        "La caméra n'est pas disponible sur ce navigateur."
      );
    }

    if (!window.isSecureContext) {
      throw createError(
        "insecure",
        "La caméra nécessite une connexion sécurisée (HTTPS)."
      );
    }

    const currentGeneration = ++generation;
    const settings = window.HELIA_CONFIG.camera;

    let mediaStream;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: settings.preferredFacingMode },
          width: { ideal: settings.preferredWidth },
          height: { ideal: settings.preferredHeight },
        },
      });
    } catch (error) {
      throw normalizeError(error);
    }

    // Un arrêt a été demandé pendant l'ouverture de la caméra.
    if (currentGeneration !== generation) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return;
    }

    stream = mediaStream;
    video = videoElement;
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      // Certains navigateurs refusent play() hors geste utilisateur :
      // l'attribut autoplay prend alors le relais.
    }

    detector = await createNativeDetector();

    if (currentGeneration !== generation) {
      return;
    }

    running = true;
    scheduleScan(currentGeneration, onDetected);
  }

  async function createNativeDetector() {
    if (!("BarcodeDetector" in window)) {
      return null;
    }

    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();

      if (!formats.includes("qr_code")) {
        return null;
      }

      return new window.BarcodeDetector({ formats: ["qr_code"] });
    } catch {
      return null;
    }
  }

  function scheduleScan(currentGeneration, onDetected) {
    timer = window.setTimeout(async () => {
      if (!running || currentGeneration !== generation) {
        return;
      }

      let value = null;

      try {
        value = await detectFrame();
      } catch (error) {
        console.warn("Analyse de l'image impossible.", error);
      }

      if (!running || currentGeneration !== generation) {
        return;
      }

      if (value) {
        running = false;
        vibrate();
        onDetected(value);
        return;
      }

      scheduleScan(currentGeneration, onDetected);
    }, window.HELIA_CONFIG.camera.scanIntervalMs);
  }

  async function detectFrame() {
    if (!video || video.readyState < 2 || !video.videoWidth) {
      return null;
    }

    if (detector) {
      const codes = await detector.detect(video);
      const code = codes.find((item) => item.rawValue);
      return code ? code.rawValue.trim() : null;
    }

    if (typeof window.jsQR !== "function") {
      return null;
    }

    // Image réduite pour garder une analyse fluide sur téléphone.
    const maxSide = 720;
    const ratio = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * ratio);
    const height = Math.round(video.videoHeight * ratio);

    if (!canvas) {
      canvas = document.createElement("canvas");
      context = canvas.getContext("2d", { willReadFrequently: true });
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    const image = context.getImageData(0, 0, width, height);
    const result = window.jsQR(image.data, width, height, {
      inversionAttempts: "attemptBoth",
    });

    return result?.data ? result.data.trim() : null;
  }

  /**
   * Indique si la lampe torche peut être pilotée.
   */
  function hasTorch() {
    const track = stream?.getVideoTracks()[0];

    try {
      return Boolean(track?.getCapabilities?.().torch);
    } catch {
      return false;
    }
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0];

    if (!track || !hasTorch()) {
      return false;
    }

    torchOn = !torchOn;

    try {
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    } catch {
      torchOn = false;
    }

    return torchOn;
  }

  function stop() {
    generation++;
    running = false;
    torchOn = false;

    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    if (video) {
      video.pause();
      video.srcObject = null;
      video = null;
    }
  }

  function vibrate() {
    try {
      navigator.vibrate?.(60);
    } catch {
      // Vibration non disponible : sans importance.
    }
  }

  function normalizeError(error) {
    const name = error?.name ?? "";

    if (name === "NotAllowedError" || name === "SecurityError") {
      return createError(
        "denied",
        "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur."
      );
    }

    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return createError("not-found", "Aucune caméra n'a été trouvée sur cet appareil.");
    }

    if (name === "NotReadableError") {
      return createError(
        "busy",
        "La caméra est déjà utilisée par une autre application."
      );
    }

    return createError("unknown", "La caméra n'a pas pu être démarrée.");
  }

  function createError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  return Object.freeze({
    isSupported,
    start,
    stop,
    hasTorch,
    toggleTorch,
  });
})();
