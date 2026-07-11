"use strict";

/**
 * Gestion du moteur d'intelligence artificielle.
 *
 * Responsabilités :
 * - charger une seule fois le modèle Teachable Machine ;
 * - analyser une image, une vidéo ou un canvas ;
 * - recadrer la zone centrale de la caméra ;
 * - sérialiser les prédictions pour éviter leur empilement ;
 * - filtrer les classes ignorées ;
 * - vérifier la stabilité d'une détection ;
 * - libérer correctement les ressources lors d'un reset.
 */
window.HeliaAI = (() => {
  const AI_STATUS = Object.freeze({
    IDLE: "idle",
    LOADING: "loading",
    READY: "ready",
    ERROR: "error",
  });

  let model = null;
  let status = AI_STATUS.IDLE;
  let classLabels = [];
  let lastError = null;

  let loadingPromise = null;
  let activePredictionPromise = null;
  let lifecycleGeneration = 0;

  let analysisCanvas = null;
  let analysisContext = null;

  let stabilityState =
    createEmptyStabilityState();

  let lastAnalysisResult = null;

  /**
   * Crée un état de stabilité vide.
   *
   * @returns {Object}
   */
  function createEmptyStabilityState() {
    return {
      normalizedClassName: "",
      displayClassName: "",
      consecutiveCount: 0,
      lastProbability: 0,
    };
  }

  /**
   * Charge le modèle configuré.
   *
   * Plusieurs appels simultanés réutilisent
   * la même promesse de chargement.
   *
   * @returns {Promise<Object>}
   */
  async function initialize() {
    if (isReady()) {
      return getSnapshot();
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    const generation =
      lifecycleGeneration;

    const pendingPromise =
      loadModel(generation);

    loadingPromise =
      pendingPromise;

    try {
      return await pendingPromise;
    } finally {
      if (
        loadingPromise ===
        pendingPromise
      ) {
        loadingPromise = null;
      }
    }
  }

  /**
   * Charge réellement le modèle.
   *
   * @param {number} generation Génération du moteur.
   * @returns {Promise<Object>}
   */
  async function loadModel(
    generation
  ) {
    status = AI_STATUS.LOADING;
    lastError = null;

    let loadedModel = null;

    try {
      validateDependencies();
      initializeAnalysisCanvas();

      const modelBaseUrl =
        getNormalizedModelBaseUrl();

      const modelUrl =
        `${modelBaseUrl}model.json`;

      const metadataUrl =
        `${modelBaseUrl}metadata.json`;

      console.info(
        "Chargement du modèle Teachable Machine…"
      );

      loadedModel =
        await window.tmImage.load(
          modelUrl,
          metadataUrl
        );

      ensureCurrentGeneration(
        generation
      );

      if (
        model &&
        model !== loadedModel
      ) {
        disposeModelResources(
          model
        );
      }

      model = loadedModel;

      classLabels =
        getModelClassLabels(
          model
        );

      status = AI_STATUS.READY;

      console.info(
        `Modèle IA chargé : ${classLabels.length} classe(s).`
      );

      console.info(
        "Classes du modèle :",
        [...classLabels]
      );

      return getSnapshot();
    } catch (originalError) {
      if (
        loadedModel &&
        loadedModel !== model
      ) {
        disposeModelResources(
          loadedModel
        );
      }

      if (
        originalError?.code ===
        "AI_OPERATION_CANCELLED"
      ) {
        if (!model) {
          status =
            AI_STATUS.IDLE;
        }

        throw originalError;
      }

      model = null;
      classLabels = [];

      status =
        AI_STATUS.ERROR;

      lastError =
        normalizeAIError(
          originalError
        );

      console.error(
        "Impossible de charger le modèle IA :",
        originalError
      );

      throw lastError;
    }
  }

  /**
   * Initialise le canvas interne réutilisé
   * pour chaque analyse.
   */
  function initializeAnalysisCanvas() {
    const outputSize =
      getCropConfiguration()
        .outputSize;

    if (!analysisCanvas) {
      analysisCanvas =
        document.createElement(
          "canvas"
        );
    }

    if (
      analysisCanvas.width !==
        outputSize ||
      analysisCanvas.height !==
        outputSize
    ) {
      analysisCanvas.width =
        outputSize;

      analysisCanvas.height =
        outputSize;

      analysisContext = null;
    }

    if (!analysisContext) {
      analysisContext =
        analysisCanvas.getContext(
          "2d",
          {
            alpha: false,

            willReadFrequently:
              false,
          }
        );
    }

    if (!analysisContext) {
      throw createAIError(
        "CANVAS_CONTEXT_ERROR",
        "Le navigateur n'a pas pu créer la zone d'analyse de l'intelligence artificielle."
      );
    }

    analysisContext.imageSmoothingEnabled =
      true;

    analysisContext.imageSmoothingQuality =
      "high";
  }

  /**
   * Analyse directement une image,
   * une vidéo ou un canvas.
   *
   * Cette fonction ne réalise aucun recadrage.
   *
   * @param {
   *   HTMLImageElement |
   *   HTMLVideoElement |
   *   HTMLCanvasElement |
   *   ImageBitmap
   * } input Élément visuel à analyser.
   *
   * @returns {Promise<Array<Object>>}
   */
  async function predict(input) {
    return runSerializedPrediction(
      async () => {
        if (!isReady()) {
          await initialize();
        }

        validatePredictionInput(
          input
        );

        const generation =
          lifecycleGeneration;

        const activeModel =
          requireReadyModel();

        try {
          const rawPredictions =
            await activeModel.predict(
              input,
              false
            );

          ensureCurrentGeneration(
            generation
          );

          return normalizeAndSortPredictions(
            rawPredictions
          );
        } catch (error) {
          throw normalizePredictionError(
            error
          );
        }
      }
    );
  }

  /**
   * Analyse uniquement la zone centrale
   * d'une vidéo.
   *
   * @param {HTMLVideoElement} videoElement Flux vidéo.
   * @returns {Promise<Object>}
   */
  async function analyzeVideo(
    videoElement
  ) {
    return runSerializedPrediction(
      async () => {
        if (!isReady()) {
          await initialize();
        }

        validateVideoElement(
          videoElement
        );

        const generation =
          lifecycleGeneration;

        const activeModel =
          requireReadyModel();

        try {
          const cropInformation =
            drawCentralVideoCrop(
              videoElement
            );

          const rawPredictions =
            await activeModel.predict(
              analysisCanvas,
              false
            );

          ensureCurrentGeneration(
            generation
          );

          const allPredictions =
            normalizeAndSortPredictions(
              rawPredictions
            );

          const displayedPredictions =
            getDisplayedPredictions(
              allPredictions
            );

          const actionablePredictions =
            getActionablePredictions(
              allPredictions
            );

          const bestCandidate =
            actionablePredictions[0] ??
            null;

          const stability =
            updateStability(
              bestCandidate
            );

          const result = {
            timestamp:
              new Date()
                .toISOString(),

            crop: {
              ...cropInformation,
            },

            allPredictions,

            displayedPredictions,

            actionablePredictions,

            bestCandidate,

            stableCandidate:
              stability.isStable &&
              bestCandidate
                ? {
                    ...bestCandidate,

                    consecutiveCount:
                      stability
                        .consecutiveCount,
                  }
                : null,

            stability,
          };

          /*
           * L'ancien résultat n'est pas conservé :
           * la référence est remplacée à chaque analyse.
           */
          lastAnalysisResult =
            cloneAnalysisResult(
              result
            );

          return result;
        } catch (error) {
          throw normalizePredictionError(
            error
          );
        }
      }
    );
  }

  /**
   * Empêche plusieurs prédictions
   * de s'exécuter en parallèle.
   *
   * @param {Function} operation Opération asynchrone.
   * @returns {Promise<unknown>}
   */
  async function runSerializedPrediction(
    operation
  ) {
    while (activePredictionPromise) {
      try {
        await activePredictionPromise;
      } catch {
        /*
         * Une erreur précédente ne doit pas bloquer
         * les prédictions suivantes.
         */
      }
    }

    const pendingPromise =
      Promise.resolve()
        .then(operation);

    activePredictionPromise =
      pendingPromise;

    try {
      return await pendingPromise;
    } finally {
      if (
        activePredictionPromise ===
        pendingPromise
      ) {
        activePredictionPromise =
          null;
      }
    }
  }

  /**
   * Dessine la zone centrale de la vidéo
   * dans le canvas interne.
   *
   * @param {HTMLVideoElement} videoElement Vidéo.
   * @returns {Object}
   */
  function drawCentralVideoCrop(
    videoElement
  ) {
    if (
      !analysisCanvas ||
      !analysisContext
    ) {
      initializeAnalysisCanvas();
    }

    const videoWidth =
      videoElement.videoWidth;

    const videoHeight =
      videoElement.videoHeight;

    if (
      !Number.isFinite(
        videoWidth
      ) ||
      !Number.isFinite(
        videoHeight
      ) ||
      videoWidth <= 0 ||
      videoHeight <= 0
    ) {
      throw createAIError(
        "INVALID_VIDEO_DIMENSIONS",
        "La caméra ne fournit pas encore une image exploitable."
      );
    }

    const cropConfig =
      getCropConfiguration();

    const maximumCropWidth =
      videoWidth *
      cropConfig.guideWidthRatio;

    const maximumCropHeight =
      videoHeight *
      cropConfig.guideMaxHeightRatio;

    const cropWidth =
      Math.min(
        maximumCropWidth,

        maximumCropHeight *
          cropConfig.aspectRatio
      );

    const cropHeight =
      cropWidth /
      cropConfig.aspectRatio;

    const sourceX =
      (videoWidth - cropWidth) /
      2;

    const sourceY =
      (videoHeight - cropHeight) /
      2;

    /*
     * drawImage couvre l'intégralité du canvas.
     * Un clearRect supplémentaire est donc inutile.
     */
    analysisContext.drawImage(
      videoElement,

      sourceX,
      sourceY,
      cropWidth,
      cropHeight,

      0,
      0,
      analysisCanvas.width,
      analysisCanvas.height
    );

    return {
      sourceX:
        Math.round(sourceX),

      sourceY:
        Math.round(sourceY),

      sourceWidth:
        Math.round(cropWidth),

      sourceHeight:
        Math.round(cropHeight),

      videoWidth,
      videoHeight,

      outputWidth:
        analysisCanvas.width,

      outputHeight:
        analysisCanvas.height,
    };
  }

  /**
   * Retourne les meilleures prédictions.
   *
   * @param {
   *   HTMLImageElement |
   *   HTMLVideoElement |
   *   HTMLCanvasElement |
   *   ImageBitmap
   * } input Élément visuel.
   *
   * @param {number|null} maximumResults Nombre maximal.
   * @returns {Promise<Array<Object>>}
   */
  async function predictTop(
    input,
    maximumResults = null
  ) {
    const predictions =
      await predict(input);

    const configuredMaximum =
      getDisplayedPredictionCount();

    const requestedMaximum =
      Number(maximumResults);

    const finalMaximum =
      Number.isInteger(
        requestedMaximum
      ) &&
      requestedMaximum > 0
        ? requestedMaximum
        : configuredMaximum;

    return predictions.slice(
      0,
      finalMaximum
    );
  }

  /**
   * Retourne la meilleure prédiction.
   *
   * @param {
   *   HTMLImageElement |
   *   HTMLVideoElement |
   *   HTMLCanvasElement |
   *   ImageBitmap
   * } input Élément visuel.
   *
   * @returns {Promise<Object|null>}
   */
  async function predictBest(input) {
    const predictions =
      await predictTop(
        input,
        1
      );

    return predictions[0] ??
      null;
  }

  /**
   * Normalise et trie les prédictions.
   *
   * @param {Array<Object>} rawPredictions Prédictions brutes.
   * @returns {Array<Object>}
   */
  function normalizeAndSortPredictions(
    rawPredictions
  ) {
    if (
      !Array.isArray(
        rawPredictions
      )
    ) {
      return [];
    }

    return rawPredictions
      .map(
        normalizePrediction
      )
      .sort(
        (
          firstPrediction,
          secondPrediction
        ) =>
          secondPrediction
            .probability -
          firstPrediction
            .probability
      );
  }

  /**
   * Retourne les prédictions visibles.
   *
   * @param {Array<Object>} predictions Liste complète.
   * @returns {Array<Object>}
   */
  function getDisplayedPredictions(
    predictions
  ) {
    return predictions.slice(
      0,
      getDisplayedPredictionCount()
    );
  }

  /**
   * Retourne les prédictions utilisables.
   *
   * @param {Array<Object>} predictions Liste complète.
   * @returns {Array<Object>}
   */
  function getActionablePredictions(
    predictions
  ) {
    const minimumConfidence =
      getMinimumConfidence();

    return predictions.filter(
      (prediction) =>
        !prediction.isIgnored &&
        prediction.probability >=
          minimumConfidence
    );
  }

  /**
   * Met à jour la stabilité de la meilleure proposition.
   *
   * @param {Object|null} candidate Proposition.
   * @returns {Object}
   */
  function updateStability(
    candidate
  ) {
    const requiredCount =
      getStablePredictionsRequired();

    if (!candidate) {
      resetStability();

      return {
        className: null,
        consecutiveCount: 0,
        requiredCount,
        isStable: false,
        progress: 0,
      };
    }

    const candidateKey =
      normalizeClassName(
        candidate.className
      );

    if (
      candidateKey &&
      candidateKey ===
        stabilityState
          .normalizedClassName
    ) {
      stabilityState
        .consecutiveCount += 1;
    } else {
      stabilityState = {
        normalizedClassName:
          candidateKey,

        displayClassName:
          candidate.className,

        consecutiveCount: 1,

        lastProbability:
          candidate.probability,
      };
    }

    stabilityState.lastProbability =
      candidate.probability;

    const isStable =
      stabilityState
        .consecutiveCount >=
      requiredCount;

    return {
      className:
        stabilityState
          .displayClassName,

      consecutiveCount:
        stabilityState
          .consecutiveCount,

      requiredCount,
      isStable,

      progress:
        Math.min(
          stabilityState
            .consecutiveCount /
            requiredCount,

          1
        ),
    };
  }

  /**
   * Réinitialise la détection stable.
   */
  function resetStability() {
    stabilityState =
      createEmptyStabilityState();
  }

  /**
   * Indique si une classe doit être ignorée.
   *
   * @param {string} className Nom de la classe.
   * @returns {boolean}
   */
  function isIgnoredClass(
    className
  ) {
    const normalizedClassName =
      normalizeClassName(
        className
      );

    return getIgnoredClasses()
      .some(
        (ignoredClassName) =>
          normalizeClassName(
            ignoredClassName
          ) ===
          normalizedClassName
      );
  }

  /**
   * Normalise un nom de classe.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function normalizeClassName(value) {
    if (
      typeof value !== "string"
    ) {
      return "";
    }

    return value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLocaleLowerCase("fr")
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  /**
   * Normalise une prédiction individuelle.
   *
   * @param {Object} prediction Prédiction brute.
   * @returns {Object}
   */
  function normalizePrediction(
    prediction
  ) {
    const className =
      String(
        prediction?.className ??
          "Classe inconnue"
      );

    const rawProbability =
      Number(
        prediction?.probability
      );

    const probability =
      Number.isFinite(
        rawProbability
      )
        ? Math.min(
            Math.max(
              rawProbability,
              0
            ),
            1
          )
        : 0;

    return {
      className,

      normalizedClassName:
        normalizeClassName(
          className
        ),

      probability,

      percentage:
        Math.round(
          probability * 1000
        ) / 10,

      isIgnored:
        isIgnoredClass(
          className
        ),

      meetsMinimumConfidence:
        probability >=
        getMinimumConfidence(),
    };
  }

  /**
   * Retourne la configuration du recadrage.
   *
   * @returns {Object}
   */
  function getCropConfiguration() {
    const configuredCrop =
      window.HELIA_CONFIG
        ?.artificialIntelligence
        ?.crop ?? {};

    return {
      outputSize:
        normalizePositiveInteger(
          configuredCrop.outputSize,
          224
        ),

      guideWidthRatio:
        normalizeRatio(
          configuredCrop
            .guideWidthRatio,
          0.72
        ),

      guideMaxHeightRatio:
        normalizeRatio(
          configuredCrop
            .guideMaxHeightRatio,
          0.58
        ),

      aspectRatio:
        normalizePositiveNumber(
          configuredCrop
            .aspectRatio,
          1
        ),
    };
  }

  function getDisplayedPredictionCount() {
    return normalizePositiveInteger(
      window.HELIA_CONFIG
        ?.artificialIntelligence
        ?.displayedPredictions,

      3
    );
  }

  function getMinimumConfidence() {
    return normalizeRatio(
      window.HELIA_CONFIG
        ?.artificialIntelligence
        ?.minimumConfidence,

      0.6
    );
  }

  function getStablePredictionsRequired() {
    return normalizePositiveInteger(
      window.HELIA_CONFIG
        ?.artificialIntelligence
        ?.stablePredictionsRequired,

      3
    );
  }

  function getIgnoredClasses() {
    const configuredClasses =
      window.HELIA_CONFIG
        ?.artificialIntelligence
        ?.ignoredClasses;

    if (
      !Array.isArray(
        configuredClasses
      )
    ) {
      return [];
    }

    return configuredClasses
      .filter(
        (className) =>
          typeof className ===
          "string"
      )
      .map(
        (className) =>
          className.trim()
      )
      .filter(Boolean);
  }

  function normalizePositiveNumber(
    value,
    fallback
  ) {
    const numericValue =
      Number(value);

    return (
      Number.isFinite(
        numericValue
      ) &&
      numericValue > 0
    )
      ? numericValue
      : fallback;
  }

  function normalizePositiveInteger(
    value,
    fallback
  ) {
    const numericValue =
      Number(value);

    return (
      Number.isInteger(
        numericValue
      ) &&
      numericValue > 0
    )
      ? numericValue
      : fallback;
  }

  function normalizeRatio(
    value,
    fallback
  ) {
    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return fallback;
    }

    return Math.min(
      Math.max(
        numericValue,
        0.01
      ),
      1
    );
  }

  /**
   * Indique si le moteur est prêt.
   *
   * @returns {boolean}
   */
  function isReady() {
    return (
      status ===
        AI_STATUS.READY &&
      model !== null
    );
  }

  /**
   * Retourne le modèle prêt.
   *
   * @returns {Object}
   */
  function requireReadyModel() {
    if (
      !isReady() ||
      !model
    ) {
      throw createAIError(
        "MODEL_NOT_READY",
        "Le modèle IA n'est pas prêt."
      );
    }

    return model;
  }

  /**
   * Vérifie qu'une opération appartient
   * encore à la génération courante.
   *
   * @param {number} generation Génération attendue.
   */
  function ensureCurrentGeneration(
    generation
  ) {
    if (
      generation !==
      lifecycleGeneration
    ) {
      throw createAIError(
        "AI_OPERATION_CANCELLED",
        "L'opération IA a été interrompue."
      );
    }
  }

  function getClassLabels() {
    return [...classLabels];
  }

  function getLastAnalysisResult() {
    return lastAnalysisResult
      ? cloneAnalysisResult(
          lastAnalysisResult
        )
      : null;
  }

  function getAnalysisCanvas() {
    return analysisCanvas;
  }

  /**
   * Retourne l'état général du moteur.
   *
   * @returns {Object}
   */
  function getSnapshot() {
    return {
      status,

      isReady:
        isReady(),

      predictionInProgress:
        activePredictionPromise !==
        null,

      classCount:
        classLabels.length,

      classLabels:
        [...classLabels],

      modelBaseUrl:
        window.HELIA_CONFIG
          ?.artificialIntelligence
          ?.modelBaseUrl || "",

      minimumConfidence:
        getMinimumConfidence(),

      stablePredictionsRequired:
        getStablePredictionsRequired(),

      ignoredClasses:
        getIgnoredClasses(),

      crop:
        getCropConfiguration(),

      tensorFlowMemory:
        getTensorFlowMemorySnapshot(),

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
   * Libère entièrement les ressources
   * locales du moteur.
   */
  function reset() {
    lifecycleGeneration += 1;

    disposeModelResources(
      model
    );

    model = null;
    classLabels = [];
    lastError = null;
    loadingPromise = null;
    lastAnalysisResult = null;

    resetStability();
    releaseAnalysisCanvas();

    status = AI_STATUS.IDLE;
  }

  /**
   * Libère le modèle lorsqu'une méthode
   * dispose() est disponible.
   *
   * @param {Object|null} modelToDispose Modèle.
   */
  function disposeModelResources(
    modelToDispose
  ) {
    if (!modelToDispose) {
      return;
    }

    if (
      typeof modelToDispose
        .dispose === "function"
    ) {
      try {
        modelToDispose.dispose();
        return;
      } catch (error) {
        console.warn(
          "Le modèle IA principal n'a pas pu être libéré complètement :",
          error
        );
      }
    }

    const possibleInternalModels = [
      modelToDispose.model,
      modelToDispose.baseModel,
      modelToDispose.model?.model,
    ];

    const disposedModels =
      new Set();

    possibleInternalModels
      .forEach(
        (internalModel) => {
          if (
            !internalModel ||
            disposedModels.has(
              internalModel
            ) ||
            typeof internalModel
              .dispose !==
              "function"
          ) {
            return;
          }

          disposedModels.add(
            internalModel
          );

          try {
            internalModel.dispose();
          } catch (error) {
            console.warn(
              "Une ressource interne du modèle IA n'a pas pu être libérée :",
              error
            );
          }
        }
      );
  }

  /**
   * Réduit le canvas interne puis
   * supprime ses références.
   */
  function releaseAnalysisCanvas() {
    if (analysisCanvas) {
      try {
        analysisCanvas.width = 1;
        analysisCanvas.height = 1;
      } catch (error) {
        console.warn(
          "Le canvas d'analyse IA n'a pas pu être réduit :",
          error
        );
      }
    }

    analysisContext = null;
    analysisCanvas = null;
  }

  /**
   * Retourne les informations mémoire
   * de TensorFlow.js.
   *
   * @returns {Object|null}
   */
  function getTensorFlowMemorySnapshot() {
    if (
      !window.tf ||
      typeof window.tf.memory !==
        "function"
    ) {
      return null;
    }

    try {
      const memory =
        window.tf.memory();

      return {
        numTensors:
          Number(
            memory.numTensors
          ) || 0,

        numDataBuffers:
          Number(
            memory.numDataBuffers
          ) || 0,

        numBytes:
          Number(
            memory.numBytes
          ) || 0,

        unreliable:
          Boolean(
            memory.unreliable
          ),

        reasons:
          Array.isArray(
            memory.reasons
          )
            ? [...memory.reasons]
            : [],
      };
    } catch (error) {
      console.warn(
        "Les informations mémoire de TensorFlow.js sont indisponibles :",
        error
      );

      return null;
    }
  }

  /**
   * Vérifie les dépendances.
   */
  function validateDependencies() {
    if (!window.HELIA_CONFIG) {
      throw createAIError(
        "MISSING_CONFIGURATION",
        "La configuration HELIA_CONFIG est introuvable."
      );
    }

    if (
      !window.tmImage ||
      typeof window.tmImage.load !==
        "function"
    ) {
      throw createAIError(
        "MISSING_TEACHABLE_MACHINE_LIBRARY",
        "La bibliothèque Teachable Machine Image n'est pas chargée."
      );
    }

    const modelBaseUrl =
      window.HELIA_CONFIG
        ?.artificialIntelligence
        ?.modelBaseUrl;

    if (
      typeof modelBaseUrl !==
        "string" ||
      !modelBaseUrl.trim()
    ) {
      throw createAIError(
        "MISSING_MODEL_URL",
        "L'adresse du modèle Teachable Machine est absente."
      );
    }
  }

  function getNormalizedModelBaseUrl() {
    const configuredUrl =
      window.HELIA_CONFIG
        .artificialIntelligence
        .modelBaseUrl
        .trim();

    return configuredUrl.endsWith(
      "/"
    )
      ? configuredUrl
      : `${configuredUrl}/`;
  }

  function getModelClassLabels(
    loadedModel
  ) {
    if (
      typeof loadedModel
        .getClassLabels ===
        "function"
    ) {
      const labels =
        loadedModel.getClassLabels();

      if (
        Array.isArray(
          labels
        )
      ) {
        return labels.map(
          String
        );
      }
    }

    const totalClasses =
      typeof loadedModel
        .getTotalClasses ===
        "function"
        ? loadedModel
            .getTotalClasses()
        : 0;

    return Array.from(
      {
        length: totalClasses,
      },

      (_, index) =>
        `Classe ${index + 1}`
    );
  }

  /**
   * Vérifie qu'un élément peut être analysé.
   *
   * @param {unknown} input Élément.
   */
  function validatePredictionInput(
    input
  ) {
    const imageBitmapIsValid =
      typeof ImageBitmap !==
        "undefined" &&
      input instanceof
        ImageBitmap;

    const validInput =
      input instanceof
        HTMLImageElement ||
      input instanceof
        HTMLVideoElement ||
      input instanceof
        HTMLCanvasElement ||
      imageBitmapIsValid;

    if (!validInput) {
      throw createAIError(
        "INVALID_PREDICTION_INPUT",
        "L'élément transmis à l'IA n'est pas une image, une vidéo ou un canvas valide."
      );
    }

    if (
      input instanceof
      HTMLVideoElement
    ) {
      validateVideoElement(
        input
      );
    }
  }

  /**
   * Vérifie qu'une vidéo est prête.
   *
   * @param {unknown} videoElement Vidéo.
   */
  function validateVideoElement(
    videoElement
  ) {
    if (
      !(
        videoElement instanceof
        HTMLVideoElement
      )
    ) {
      throw createAIError(
        "INVALID_VIDEO_ELEMENT",
        "L'élément transmis n'est pas une vidéo valide."
      );
    }

    if (
      videoElement.readyState <
      HTMLMediaElement
        .HAVE_CURRENT_DATA
    ) {
      throw createAIError(
        "VIDEO_NOT_READY",
        "La caméra ne fournit pas encore d'image exploitable."
      );
    }

    if (
      videoElement.videoWidth <=
        0 ||
      videoElement.videoHeight <=
        0
    ) {
      throw createAIError(
        "VIDEO_DIMENSIONS_NOT_READY",
        "Les dimensions de l'image de la caméra ne sont pas encore disponibles."
      );
    }
  }

  /**
   * Copie un résultat d'analyse.
   *
   * @param {Object} result Résultat source.
   * @returns {Object}
   */
  function cloneAnalysisResult(
    result
  ) {
    return {
      ...result,

      crop:
        result.crop
          ? {
              ...result.crop,
            }
          : null,

      allPredictions:
        result.allPredictions
          ?.map(
            (prediction) => ({
              ...prediction,
            })
          ) ?? [],

      displayedPredictions:
        result.displayedPredictions
          ?.map(
            (prediction) => ({
              ...prediction,
            })
          ) ?? [],

      actionablePredictions:
        result.actionablePredictions
          ?.map(
            (prediction) => ({
              ...prediction,
            })
          ) ?? [],

      bestCandidate:
        result.bestCandidate
          ? {
              ...result.bestCandidate,
            }
          : null,

      stableCandidate:
        result.stableCandidate
          ? {
              ...result
                .stableCandidate,
            }
          : null,

      stability:
        result.stability
          ? {
              ...result.stability,
            }
          : null,
    };
  }

  function normalizeAIError(
    error
  ) {
    if (
      error?.name ===
      "HeliaAIError"
    ) {
      return error;
    }

    if (
      error instanceof
        TypeError &&
      String(
        error.message
      )
        .toLocaleLowerCase()
        .includes("fetch")
    ) {
      return createAIError(
        "MODEL_NETWORK_ERROR",
        "Le modèle IA n'a pas pu être téléchargé. Vérifiez la connexion Internet et l'adresse du modèle.",
        error
      );
    }

    return createAIError(
      "MODEL_LOADING_ERROR",
      "Le modèle Teachable Machine n'a pas pu être chargé.",
      error
    );
  }

  function normalizePredictionError(
    error
  ) {
    if (
      error?.name ===
      "HeliaAIError"
    ) {
      return error;
    }

    return createAIError(
      "PREDICTION_ERROR",
      "L'intelligence artificielle n'a pas pu analyser l'image.",
      error
    );
  }

  function createAIError(
    code,
    message,
    originalError = null
  ) {
    const error =
      new Error(message);

    error.name =
      "HeliaAIError";

    error.code = code;

    error.originalError =
      originalError;

    return error;
  }

  /**
   * Libère le moteur quand la page est quittée.
   */
  window.addEventListener(
    "pagehide",
    reset
  );

  return Object.freeze({
    AI_STATUS,

    initialize,

    predict,
    predictTop,
    predictBest,
    analyzeVideo,

    isReady,
    isIgnoredClass,

    getClassLabels,
    getLastAnalysisResult,
    getAnalysisCanvas,
    getSnapshot,

    resetStability,
    reset,
  });
})();