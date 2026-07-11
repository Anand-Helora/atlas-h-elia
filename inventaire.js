"use strict";

/**
 * Gestion des relevés, locaux et objets d'ATLAS H-ELIA.
 *
 * Principes :
 * - un relevé contient plusieurs locaux ;
 * - un local contient plusieurs objets ;
 * - un seul local est actif à la fois ;
 * - deux objets portant le même nom dans un même local sont regroupés.
 */
window.HeliaInventory = (() => {
  const STORAGE_KEY =
    "atlas-h-elia.inventory.survey.v3";

  const PREVIOUS_SURVEY_STORAGE_KEY =
    "atlas-h-elia.inventory.survey.v2";

  const LEGACY_SESSION_STORAGE_KEY =
    "atlas-h-elia.inventory.session.v1";

  const STORAGE_SCHEMA_VERSION = 3;
  const MAXIMUM_ITEM_QUANTITY = 999;

  const MAXIMUM_LENGTHS = Object.freeze({
    surveyName: 160,
    reference: 120,
    site: 160,
    building: 160,
    level: 80,
    unit: 160,
    operatorName: 160,
    notes: 3000,
    localIdentifier: 120,
    itemLabel: 160,
    source: 80,
    identifier: 220,
  });

  const SCAN_STATUS = Object.freeze({
    IDLE: "idle",
    READY: "ready",
    SCANNING: "scanning",
    PAUSED: "paused",
    COMPLETED: "completed",
  });

  const VALID_SCAN_STATUSES = new Set(
    Object.values(SCAN_STATUS)
  );

  let survey = createEmptySurvey();

  /*
   * Utilisé uniquement par « Annuler le dernier ajout ».
   * Lorsqu'un scan augmente une ligne existante, on mémorise
   * l'état précédent afin de restaurer la quantité au lieu
   * de supprimer toute la ligne.
   */
  let pendingMergedItemUndo = null;

  const persistenceState = {
    isAvailable: false,
    hasStoredSurvey: false,
    hasStoredSession: false,
    wasRestored: false,
    wasMigrated: false,
    migratedFrom: null,
    lastSavedAt: null,
    lastError: null,
  };

  initializePersistence();

  /* =========================================================
     CRÉATION DES DONNÉES
     ========================================================= */

  function createEmptySurvey() {
    const now = createTimestamp();

    return {
      id: createIdentifier("survey"),
      name: "",
      reference: "",
      site: "",
      building: "",
      level: "",
      unit: "",
      operatorName: "",
      surveyDate: createLocalDateString(),
      notes: "",
      createdAt: now,
      updatedAt: now,
      activeLocalId: null,
      locals: [],
    };
  }

  function createEmptyLocal(identifier) {
    const now = createTimestamp();

    return {
      id: createIdentifier("local"),
      identifier,
      status: SCAN_STATUS.READY,
      createdAt: now,
      updatedAt: now,
      scanStartedAt: null,
      scanCompletedAt: null,
      items: [],
    };
  }

  /* =========================================================
     INITIALISATION ET MIGRATIONS
     ========================================================= */

  function initializePersistence() {
    persistenceState.isAvailable =
      testLocalStorageAvailability();

    if (!persistenceState.isAvailable) {
      console.warn(
        "Le stockage local est indisponible. " +
          "Le relevé restera utilisable, mais il sera perdu après un rechargement."
      );

      return;
    }

    if (restoreCurrentSurvey()) {
      return;
    }

    if (migratePreviousSurvey()) {
      return;
    }

    migrateLegacySession();
  }

  function testLocalStorageAvailability() {
    try {
      const testKey =
        `${STORAGE_KEY}.availability-test`;

      window.localStorage.setItem(
        testKey,
        "available"
      );

      window.localStorage.removeItem(
        testKey
      );

      return true;
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      return false;
    }
  }

  function restoreCurrentSurvey() {
    const payload =
      readStoragePayload(STORAGE_KEY);

    if (!payload) {
      return false;
    }

    try {
      survey = normalizeStoredSurvey(
        extractSurveyFromPayload(payload)
      );

      persistenceState.hasStoredSurvey = true;

      persistenceState.hasStoredSession =
        survey.locals.length > 0;

      persistenceState.wasRestored = true;
      persistenceState.wasMigrated = false;
      persistenceState.migratedFrom = null;
      persistenceState.lastError = null;

      /*
       * Réécrit les données normalisées.
       * Les doublons déjà présents sont ainsi
       * regroupés durablement.
       */
      persistSurvey();

      console.info(
        "Relevé restauré.",
        {
          name:
            getSurveyDisplayName(
              survey
            ),

          localCount:
            survey.locals.length,

          totalQuantity:
            calculateSurveyTotalQuantity(
              survey.locals
            ),
        }
      );

      return true;
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      console.error(
        "La sauvegarde actuelle du relevé est illisible.",
        error
      );

      removeStorageEntry(
        STORAGE_KEY
      );

      survey = createEmptySurvey();

      return false;
    }
  }

  function migratePreviousSurvey() {
    const payload =
      readStoragePayload(
        PREVIOUS_SURVEY_STORAGE_KEY
      );

    if (!payload) {
      return false;
    }

    try {
      survey = normalizeStoredSurvey(
        extractSurveyFromPayload(payload)
      );

      persistenceState.wasRestored = true;
      persistenceState.wasMigrated = true;

      persistenceState.migratedFrom =
        "multi-local-v2";

      const wasSaved =
        persistSurvey();

      if (wasSaved) {
        removeStorageEntry(
          PREVIOUS_SURVEY_STORAGE_KEY
        );
      }

      console.info(
        "Relevé multi-local v2 converti vers la version 3.",
        {
          localCount:
            survey.locals.length,

          totalQuantity:
            calculateSurveyTotalQuantity(
              survey.locals
            ),
        }
      );

      return true;
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      console.error(
        "Le relevé multi-local précédent n'a pas pu être migré.",
        error
      );

      return false;
    }
  }

  function migrateLegacySession() {
    const payload =
      readStoragePayload(
        LEGACY_SESSION_STORAGE_KEY
      );

    if (!payload) {
      return false;
    }

    try {
      const legacySession =
        extractLegacySessionFromPayload(
          payload
        );

      const migratedLocal =
        normalizeLegacySessionAsLocal(
          legacySession
        );

      const migratedSurvey =
        createEmptySurvey();

      if (migratedLocal) {
        migratedSurvey.locals.push(
          migratedLocal
        );

        migratedSurvey.activeLocalId =
          migratedLocal.id;

        migratedSurvey.createdAt =
          migratedLocal.createdAt;

        migratedSurvey.updatedAt =
          createTimestamp();
      }

      survey = migratedSurvey;

      persistenceState.wasRestored =
        Boolean(migratedLocal);

      persistenceState.wasMigrated =
        Boolean(migratedLocal);

      persistenceState.migratedFrom =
        migratedLocal
          ? "single-local-v1"
          : null;

      const wasSaved =
        persistSurvey();

      if (wasSaved) {
        removeStorageEntry(
          LEGACY_SESSION_STORAGE_KEY
        );
      }

      if (migratedLocal) {
        console.info(
          "Ancienne session mono-local convertie en relevé.",
          {
            local:
              migratedLocal.identifier,

            totalQuantity:
              calculateLocalTotalQuantity(
                migratedLocal.items
              ),
          }
        );
      }

      return Boolean(
        migratedLocal
      );
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      console.error(
        "L'ancienne session n'a pas pu être migrée.",
        error
      );

      return false;
    }
  }

  function readStoragePayload(
    storageKey
  ) {
    if (
      !persistenceState.isAvailable
    ) {
      return null;
    }

    try {
      const serializedPayload =
        window.localStorage.getItem(
          storageKey
        );

      if (!serializedPayload) {
        return null;
      }

      return JSON.parse(
        serializedPayload
      );
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      console.error(
        `La sauvegarde « ${storageKey} » est illisible.`,
        error
      );

      return null;
    }
  }

  function extractSurveyFromPayload(
    payload
  ) {
    if (
      !payload ||
      typeof payload !== "object"
    ) {
      throw createInventoryError(
        "INVALID_STORED_PAYLOAD",
        "La sauvegarde ne contient pas de données valides."
      );
    }

    if (
      payload.survey &&
      typeof payload.survey ===
        "object"
    ) {
      return payload.survey;
    }

    if (
      Array.isArray(
        payload.locals
      )
    ) {
      return payload;
    }

    throw createInventoryError(
      "INVALID_STORED_SURVEY",
      "Aucun relevé valide n'a été trouvé."
    );
  }

  function extractLegacySessionFromPayload(
    payload
  ) {
    if (
      !payload ||
      typeof payload !== "object"
    ) {
      throw createInventoryError(
        "INVALID_LEGACY_PAYLOAD",
        "L'ancienne sauvegarde est invalide."
      );
    }

    if (
      payload.session &&
      typeof payload.session ===
        "object"
    ) {
      return payload.session;
    }

    return payload;
  }

  /* =========================================================
     NORMALISATION DES DONNÉES SAUVEGARDÉES
     ========================================================= */

  function normalizeStoredSurvey(
    storedSurvey
  ) {
    if (
      !storedSurvey ||
      typeof storedSurvey !== "object"
    ) {
      throw createInventoryError(
        "INVALID_STORED_SURVEY",
        "Le relevé sauvegardé est invalide."
      );
    }

    const locals =
      normalizeStoredLocals(
        storedSurvey.locals
      );

    let activeLocalId =
      normalizeOptionalText(
        storedSurvey.activeLocalId,
        MAXIMUM_LENGTHS.identifier
      ) || null;

    const activeLocalExists =
      locals.some(
        (local) =>
          local.id === activeLocalId
      );

    if (!activeLocalExists) {
      activeLocalId =
        locals[0]?.id ?? null;
    }

    return {
      id:
        normalizeOptionalText(
          storedSurvey.id,
          MAXIMUM_LENGTHS.identifier
        ) ||
        createIdentifier("survey"),

      name:
        normalizeOptionalText(
          storedSurvey.name,
          MAXIMUM_LENGTHS.surveyName
        ),

      reference:
        normalizeOptionalText(
          storedSurvey.reference,
          MAXIMUM_LENGTHS.reference
        ),

      site:
        normalizeOptionalText(
          storedSurvey.site,
          MAXIMUM_LENGTHS.site
        ),

      building:
        normalizeOptionalText(
          storedSurvey.building,
          MAXIMUM_LENGTHS.building
        ),

      level:
        normalizeOptionalText(
          storedSurvey.level,
          MAXIMUM_LENGTHS.level
        ),

      unit:
        normalizeOptionalText(
          storedSurvey.unit,
          MAXIMUM_LENGTHS.unit
        ),

      operatorName:
        normalizeOptionalText(
          storedSurvey.operatorName,
          MAXIMUM_LENGTHS.operatorName
        ),

      surveyDate:
        normalizeStoredDateOnly(
          storedSurvey.surveyDate
        ),

      notes:
        normalizeOptionalMultilineText(
          storedSurvey.notes,
          MAXIMUM_LENGTHS.notes
        ),

      createdAt:
        normalizeTimestamp(
          storedSurvey.createdAt
        ),

      updatedAt:
        normalizeTimestamp(
          storedSurvey.updatedAt
        ),

      activeLocalId,
      locals,
    };
  }

  function normalizeStoredLocals(
    storedLocals
  ) {
    if (
      !Array.isArray(
        storedLocals
      )
    ) {
      return [];
    }

    const usedLocalIds =
      new Set();

    return storedLocals
      .map(
        (storedLocal) =>
          normalizeStoredLocal(
            storedLocal,
            usedLocalIds
          )
      )
      .filter(Boolean);
  }

  function normalizeStoredLocal(
    storedLocal,
    usedLocalIds
  ) {
    if (
      !storedLocal ||
      typeof storedLocal !== "object"
    ) {
      return null;
    }

    const identifier =
      normalizeOptionalText(
        storedLocal.identifier ??
          storedLocal.localIdentifier,

        MAXIMUM_LENGTHS.localIdentifier
      );

    if (!identifier) {
      return null;
    }

    let id =
      normalizeOptionalText(
        storedLocal.id ??
          storedLocal.localId,

        MAXIMUM_LENGTHS.identifier
      );

    if (
      !id ||
      usedLocalIds.has(id)
    ) {
      id =
        createIdentifier(
          "local"
        );
    }

    usedLocalIds.add(id);

    let status =
      VALID_SCAN_STATUSES.has(
        storedLocal.status
      )
        ? storedLocal.status
        : SCAN_STATUS.READY;

    /*
     * Après rechargement,
     * la caméra est toujours arrêtée.
     */
    if (
      status ===
      SCAN_STATUS.SCANNING
    ) {
      status =
        SCAN_STATUS.PAUSED;
    }

    if (
      status ===
      SCAN_STATUS.IDLE
    ) {
      status =
        SCAN_STATUS.READY;
    }

    return {
      id,
      identifier,
      status,

      createdAt:
        normalizeTimestamp(
          storedLocal.createdAt
        ),

      updatedAt:
        normalizeTimestamp(
          storedLocal.updatedAt
        ),

      scanStartedAt:
        normalizeNullableTimestamp(
          storedLocal.scanStartedAt
        ),

      scanCompletedAt:
        normalizeNullableTimestamp(
          storedLocal.scanCompletedAt
        ),

      items:
        normalizeStoredItems(
          storedLocal.items
        ),
    };
  }

  function normalizeLegacySessionAsLocal(
    legacySession
  ) {
    if (
      !legacySession ||
      typeof legacySession !== "object"
    ) {
      return null;
    }

    const identifier =
      normalizeOptionalText(
        legacySession.localIdentifier,
        MAXIMUM_LENGTHS.localIdentifier
      );

    if (!identifier) {
      return null;
    }

    return normalizeStoredLocal(
      {
        ...legacySession,

        id:
          legacySession.id ||
          createIdentifier(
            "local"
          ),

        identifier,
      },
      new Set()
    );
  }

  function normalizeStoredItems(
    storedItems
  ) {
    if (
      !Array.isArray(
        storedItems
      )
    ) {
      return [];
    }

    const usedItemIds =
      new Set();

    const normalizedItems =
      storedItems
        .map(
          (storedItem) =>
            normalizeStoredItem(
              storedItem,
              usedItemIds
            )
        )
        .filter(Boolean);

    return mergeDuplicateItems(
      normalizedItems
    );
  }

  function normalizeStoredItem(
    storedItem,
    usedItemIds
  ) {
    if (
      !storedItem ||
      typeof storedItem !== "object"
    ) {
      return null;
    }

    const label =
      normalizeOptionalText(
        storedItem.label,
        MAXIMUM_LENGTHS.itemLabel
      );

    if (!label) {
      return null;
    }

    let id =
      normalizeOptionalText(
        storedItem.id,
        MAXIMUM_LENGTHS.identifier
      );

    if (
      !id ||
      usedItemIds.has(id)
    ) {
      id =
        createIdentifier(
          "item"
        );
    }

    usedItemIds.add(id);

    const createdAt =
      normalizeTimestamp(
        storedItem.createdAt
      );

    return {
      id,
      label,

      quantity:
        normalizeQuantity(
          storedItem.quantity
        ),

      confidence:
        normalizeConfidence(
          storedItem.confidence
        ),

      source:
        normalizeOptionalText(
          storedItem.source,
          MAXIMUM_LENGTHS.source
        ) || "unknown",

      createdAt,

      updatedAt:
        normalizeTimestamp(
          storedItem.updatedAt,
          createdAt
        ),
    };
  }

  /**
   * Regroupe les doublons déjà présents.
   * Le regroupement reste limité au local concerné.
   */
  function mergeDuplicateItems(
    items
  ) {
    const mergedItems = [];
    const itemByKey = new Map();

    items.forEach(
      (item) => {
        const comparisonKey =
          createItemComparisonKey(
            item.label
          );

        const existingItem =
          itemByKey.get(
            comparisonKey
          );

        if (!existingItem) {
          const copiedItem = {
            ...item,
          };

          mergedItems.push(
            copiedItem
          );

          itemByKey.set(
            comparisonKey,
            copiedItem
          );

          return;
        }

        const acceptedQuantity =
          mergeItemValues(
            existingItem,
            item.quantity,
            item.confidence,
            item.source,
            item.updatedAt
          );

        existingItem.createdAt =
          getEarlierTimestamp(
            existingItem.createdAt,
            item.createdAt
          );

        /*
         * Une ligne est limitée à 999.
         * L'excédent est conservé séparément
         * afin de ne perdre aucune donnée.
         */
        if (
          acceptedQuantity <
          item.quantity
        ) {
          const overflowItem = {
            ...item,

            quantity:
              item.quantity -
              acceptedQuantity,
          };

          mergedItems.push(
            overflowItem
          );

          itemByKey.set(
            comparisonKey,
            overflowItem
          );
        }
      }
    );

    return mergedItems;
  }

  function createItemComparisonKey(
    label
  ) {
    return normalizeOptionalText(
      label,
      MAXIMUM_LENGTHS.itemLabel
    )
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLocaleLowerCase("fr")
      .trim();
  }

  function findItemByLabel(
    local,
    label
  ) {
    const comparisonKey =
      createItemComparisonKey(
        label
      );

    return (
      local.items.find(
        (item) =>
          createItemComparisonKey(
            item.label
          ) === comparisonKey
      ) ?? null
    );
  }

  function mergeItemValues(
    targetItem,
    addedQuantity,
    addedConfidence,
    addedSource,
    updatedAt
  ) {
    const previousQuantity =
      normalizeQuantity(
        targetItem.quantity
      );

    const normalizedAddedQuantity =
      normalizeQuantity(
        addedQuantity
      );

    const availableQuantity =
      Math.max(
        MAXIMUM_ITEM_QUANTITY -
          previousQuantity,
        0
      );

    const acceptedQuantity =
      Math.min(
        normalizedAddedQuantity,
        availableQuantity
      );

    if (
      acceptedQuantity <= 0
    ) {
      return 0;
    }

    targetItem.confidence =
      mergeConfidences(
        targetItem.confidence,
        previousQuantity,
        addedConfidence,
        acceptedQuantity
      );

    targetItem.quantity =
      previousQuantity +
      acceptedQuantity;

    targetItem.source =
      mergeItemSources(
        targetItem.source,
        addedSource
      );

    targetItem.updatedAt =
      normalizeTimestamp(
        updatedAt
      );

    return acceptedQuantity;
  }

  function mergeConfidences(
    currentConfidence,
    currentQuantity,
    addedConfidence,
    addedQuantity
  ) {
    const normalizedCurrentConfidence =
      normalizeConfidence(
        currentConfidence
      );

    const normalizedAddedConfidence =
      normalizeConfidence(
        addedConfidence
      );

    if (
      normalizedCurrentConfidence ===
        null &&
      normalizedAddedConfidence ===
        null
    ) {
      return null;
    }

    if (
      normalizedCurrentConfidence ===
      null
    ) {
      return normalizedAddedConfidence;
    }

    if (
      normalizedAddedConfidence ===
      null
    ) {
      return normalizedCurrentConfidence;
    }

    const totalWeight =
      currentQuantity +
      addedQuantity;

    if (totalWeight <= 0) {
      return normalizedAddedConfidence;
    }

    return (
      normalizedCurrentConfidence *
        currentQuantity +
      normalizedAddedConfidence *
        addedQuantity
    ) / totalWeight;
  }

  function mergeItemSources(
    currentSource,
    addedSource
  ) {
    const normalizedCurrentSource =
      normalizeOptionalText(
        currentSource,
        MAXIMUM_LENGTHS.source
      ) || "unknown";

    const normalizedAddedSource =
      normalizeOptionalText(
        addedSource,
        MAXIMUM_LENGTHS.source
      ) || "unknown";

    if (
      normalizedCurrentSource ===
      normalizedAddedSource
    ) {
      return normalizedCurrentSource;
    }

    if (
      normalizedCurrentSource ===
      "unknown"
    ) {
      return normalizedAddedSource;
    }

    if (
      normalizedAddedSource ===
      "unknown"
    ) {
      return normalizedCurrentSource;
    }

    return "mixed";
  }

  function getEarlierTimestamp(
    firstTimestamp,
    secondTimestamp
  ) {
    return (
      Date.parse(
        firstTimestamp
      ) <=
      Date.parse(
        secondTimestamp
      )
        ? firstTimestamp
        : secondTimestamp
    );
  }

  /* =========================================================
     INFORMATIONS DU RELEVÉ
     ========================================================= */

  function setSurveyInformation(
    information = {}
  ) {
    if (
      !information ||
      typeof information !== "object" ||
      Array.isArray(
        information
      )
    ) {
      throw createInventoryError(
        "INVALID_SURVEY_INFORMATION",
        "Les informations du relevé sont invalides."
      );
    }

    if (
      hasOwnProperty(
        information,
        "name"
      )
    ) {
      survey.name =
        normalizeOptionalText(
          information.name,
          MAXIMUM_LENGTHS.surveyName
        );
    }

    if (
      hasOwnProperty(
        information,
        "reference"
      )
    ) {
      survey.reference =
        normalizeOptionalText(
          information.reference,
          MAXIMUM_LENGTHS.reference
        );
    }

    if (
      hasOwnProperty(
        information,
        "site"
      )
    ) {
      survey.site =
        normalizeOptionalText(
          information.site,
          MAXIMUM_LENGTHS.site
        );
    }

    if (
      hasOwnProperty(
        information,
        "building"
      )
    ) {
      survey.building =
        normalizeOptionalText(
          information.building,
          MAXIMUM_LENGTHS.building
        );
    }

    if (
      hasOwnProperty(
        information,
        "level"
      )
    ) {
      survey.level =
        normalizeOptionalText(
          information.level,
          MAXIMUM_LENGTHS.level
        );
    }

    if (
      hasOwnProperty(
        information,
        "unit"
      )
    ) {
      survey.unit =
        normalizeOptionalText(
          information.unit,
          MAXIMUM_LENGTHS.unit
        );
    }

    if (
      hasOwnProperty(
        information,
        "operatorName"
      )
    ) {
      survey.operatorName =
        normalizeOptionalText(
          information.operatorName,
          MAXIMUM_LENGTHS.operatorName
        );
    }

    if (
      hasOwnProperty(
        information,
        "surveyDate"
      )
    ) {
      survey.surveyDate =
        normalizeEditableDateOnly(
          information.surveyDate
        );
    }

    if (
      hasOwnProperty(
        information,
        "notes"
      )
    ) {
      survey.notes =
        normalizeOptionalMultilineText(
          information.notes,
          MAXIMUM_LENGTHS.notes
        );
    }

    markSurveyAsChanged();

    return getSurveyInformationSnapshot();
  }

  function setSurveyName(
    name
  ) {
    setSurveyInformation({
      name,
    });

    return getSurveySnapshot();
  }

  function getSurveyInformationSnapshot() {
    return {
      name:
        survey.name,

      reference:
        survey.reference,

      site:
        survey.site,

      building:
        survey.building,

      level:
        survey.level,

      unit:
        survey.unit,

      operatorName:
        survey.operatorName,

      surveyDate:
        survey.surveyDate,

      notes:
        survey.notes,

      displayName:
        getSurveyDisplayName(
          survey
        ),

      hasInformation:
        hasMeaningfulSurveyInformation(
          survey
        ),
    };
  }

  /* =========================================================
     GESTION DES LOCAUX
     ========================================================= */

  function createLocal(
    identifier
  ) {
    const normalizedIdentifier =
      normalizeRequiredText(
        identifier,
        "L'identifiant du local est obligatoire.",
        MAXIMUM_LENGTHS.localIdentifier
      );

    pendingMergedItemUndo = null;

    const local =
      createEmptyLocal(
        normalizedIdentifier
      );

    survey.locals.push(
      local
    );

    survey.activeLocalId =
      local.id;

    markSurveyAsChanged(
      local,
      local.createdAt
    );

    return cloneLocalSnapshot(
      local
    );
  }

  function setLocalIdentifier(
    identifier
  ) {
    const activeLocal =
      getActiveLocalRecord();

    if (!activeLocal) {
      return createLocal(
        identifier
      );
    }

    return renameLocal(
      activeLocal.id,
      identifier
    );
  }

  function renameLocal(
    localId,
    identifier
  ) {
    const local =
      findLocalById(
        localId
      );

    if (!local) {
      throw createInventoryError(
        "LOCAL_NOT_FOUND",
        "Le local à renommer est introuvable."
      );
    }

    local.identifier =
      normalizeRequiredText(
        identifier,
        "L'identifiant du local est obligatoire.",
        MAXIMUM_LENGTHS.localIdentifier
      );

    pendingMergedItemUndo = null;

    markSurveyAsChanged(
      local
    );

    return cloneLocalSnapshot(
      local
    );
  }

  function selectLocal(
    localId
  ) {
    const local =
      findLocalById(
        localId
      );

    if (!local) {
      throw createInventoryError(
        "LOCAL_NOT_FOUND",
        "Le local demandé est introuvable."
      );
    }

    const previousLocal =
      getActiveLocalRecord();

    if (
      previousLocal &&
      previousLocal.id !==
        local.id &&
      previousLocal.status ===
        SCAN_STATUS.SCANNING
    ) {
      previousLocal.status =
        SCAN_STATUS.PAUSED;

      previousLocal.updatedAt =
        createTimestamp();
    }

    pendingMergedItemUndo = null;

    survey.activeLocalId =
      local.id;

    markSurveyAsChanged();

    return cloneLocalSnapshot(
      local
    );
  }

  function removeLocal(
    localId
  ) {
    const normalizedId =
      normalizeOptionalText(
        localId,
        MAXIMUM_LENGTHS.identifier
      );

    if (!normalizedId) {
      return false;
    }

    const localIndex =
      survey.locals.findIndex(
        (local) =>
          local.id ===
          normalizedId
      );

    if (localIndex < 0) {
      return false;
    }

    if (
      pendingMergedItemUndo
        ?.localId === normalizedId
    ) {
      pendingMergedItemUndo =
        null;
    }

    survey.locals.splice(
      localIndex,
      1
    );

    if (
      survey.activeLocalId ===
      normalizedId
    ) {
      survey.activeLocalId =
        survey.locals[
          Math.max(
            0,
            localIndex - 1
          )
        ]?.id ??
        survey.locals[0]?.id ??
        null;
    }

    markSurveyAsChanged();

    return true;
  }

  /* =========================================================
     ÉTAT DU SCAN
     ========================================================= */

  function startScan() {
    const local =
      requireActiveLocal();

    const now =
      createTimestamp();

    local.status =
      SCAN_STATUS.SCANNING;

    if (!local.scanStartedAt) {
      local.scanStartedAt =
        now;
    }

    local.scanCompletedAt =
      null;

    markSurveyAsChanged(
      local,
      now
    );

    return cloneLocalSnapshot(
      local
    );
  }

  function stopScan() {
    const local =
      getActiveLocalRecord();

    if (
      !local ||
      local.status !==
        SCAN_STATUS.SCANNING
    ) {
      return false;
    }

    const now =
      createTimestamp();

    local.status =
      SCAN_STATUS.COMPLETED;

    local.scanCompletedAt =
      now;

    markSurveyAsChanged(
      local,
      now
    );

    return true;
  }

  function isScanActive() {
    return (
      getActiveLocalRecord()
        ?.status ===
      SCAN_STATUS.SCANNING
    );
  }

  /* =========================================================
     GESTION DES OBJETS
     ========================================================= */

  function addItem({
    label,
    quantity = 1,
    confidence = null,
    source = "manual",
  } = {}) {
    const local =
      requireActiveLocal();

    const normalizedLabel =
      normalizeRequiredText(
        label,
        "Le nom de l'objet est obligatoire.",
        MAXIMUM_LENGTHS.itemLabel
      );

    const normalizedQuantity =
      normalizeQuantity(
        quantity
      );

    const normalizedConfidence =
      normalizeConfidence(
        confidence
      );

    const normalizedSource =
      normalizeOptionalText(
        source,
        MAXIMUM_LENGTHS.source
      ) || "unknown";

    const now =
      createTimestamp();

    /*
     * Une nouvelle validation remplace
     * l'opération d'annulation précédente.
     */
    pendingMergedItemUndo = null;

    const existingItem =
      findItemByLabel(
        local,
        normalizedLabel
      );

    if (existingItem) {
      const previousItemState =
        cloneItem(
          existingItem
        );

      const acceptedQuantity =
        mergeItemValues(
          existingItem,
          normalizedQuantity,
          normalizedConfidence,
          normalizedSource,
          now
        );

      if (
        acceptedQuantity <= 0
      ) {
        throw createInventoryError(
          "MAXIMUM_ITEM_QUANTITY_REACHED",
          `La quantité maximale de ${MAXIMUM_ITEM_QUANTITY} est déjà atteinte pour « ${existingItem.label} ».`
        );
      }

      pendingMergedItemUndo = {
        localId:
          local.id,

        itemId:
          existingItem.id,

        previousItemState,
      };

      markSurveyAsChanged(
        local,
        now
      );

      return {
        ...cloneItem(
          existingItem
        ),

        wasMerged:
          true,

        addedQuantity:
          acceptedQuantity,
      };
    }

    const item = {
      id:
        createIdentifier(
          "item"
        ),

      label:
        normalizedLabel,

      quantity:
        normalizedQuantity,

      confidence:
        normalizedConfidence,

      source:
        normalizedSource,

      createdAt:
        now,

      updatedAt:
        now,
    };

    local.items.push(
      item
    );

    markSurveyAsChanged(
      local,
      now
    );

    return {
      ...cloneItem(item),

      wasMerged:
        false,

      addedQuantity:
        normalizedQuantity,
    };
  }

  function updateItemQuantity(
    itemId,
    quantity,
    localId = null
  ) {
    const local =
      localId
        ? findLocalById(
            localId
          )
        : getActiveLocalRecord();

    if (!local) {
      throw createInventoryError(
        "LOCAL_NOT_FOUND",
        "Le local contenant l'objet est introuvable."
      );
    }

    const item =
      findItemById(
        local,
        itemId
      );

    if (!item) {
      throw createInventoryError(
        "ITEM_NOT_FOUND",
        "L'objet à modifier est introuvable."
      );
    }

    const now =
      createTimestamp();

    pendingMergedItemUndo = null;

    item.quantity =
      normalizeQuantity(
        quantity
      );

    item.updatedAt =
      now;

    markSurveyAsChanged(
      local,
      now
    );

    return cloneItem(
      item
    );
  }

  function removeItem(
    itemId,
    localId = null
  ) {
    const normalizedId =
      normalizeOptionalText(
        itemId,
        MAXIMUM_LENGTHS.identifier
      );

    if (!normalizedId) {
      return false;
    }

    /*
     * ui.js appelle removeItem sans localId pour
     * « Annuler le dernier ajout ».
     *
     * Si le dernier ajout avait augmenté une
     * ligne existante, son état précédent est restauré.
     *
     * Dans le récapitulatif, localId est fourni :
     * « Supprimer » efface donc toute la ligne.
     */
    if (
      localId === null &&
      pendingMergedItemUndo &&
      pendingMergedItemUndo
        .itemId === normalizedId
    ) {
      const undoOperation =
        pendingMergedItemUndo;

      pendingMergedItemUndo =
        null;

      const undoLocal =
        findLocalById(
          undoOperation.localId
        );

      if (!undoLocal) {
        return false;
      }

      const itemToRestore =
        findItemById(
          undoLocal,
          undoOperation.itemId
        );

      if (!itemToRestore) {
        return false;
      }

      const previous =
        undoOperation
          .previousItemState;

      itemToRestore.label =
        previous.label;

      itemToRestore.quantity =
        previous.quantity;

      itemToRestore.confidence =
        previous.confidence;

      itemToRestore.source =
        previous.source;

      itemToRestore.createdAt =
        previous.createdAt;

      itemToRestore.updatedAt =
        previous.updatedAt;

      markSurveyAsChanged(
        undoLocal
      );

      return true;
    }

    pendingMergedItemUndo = null;

    const local =
      localId
        ? findLocalById(
            localId
          )
        : getActiveLocalRecord();

    if (!local) {
      return false;
    }

    const itemIndex =
      local.items.findIndex(
        (item) =>
          item.id ===
          normalizedId
      );

    if (itemIndex < 0) {
      return false;
    }

    local.items.splice(
      itemIndex,
      1
    );

    markSurveyAsChanged(
      local
    );

    return true;
  }

  /* =========================================================
     SNAPSHOTS PUBLICS
     ========================================================= */

  function getSessionSnapshot() {
    const activeLocal =
      getActiveLocalRecord();

    return activeLocal
      ? cloneLocalSnapshot(
          activeLocal
        )
      : createEmptyLocalSnapshot();
  }

  function getActiveLocalSnapshot() {
    return getSessionSnapshot();
  }

  function getLocalSnapshot(
    localId
  ) {
    const local =
      findLocalById(
        localId
      );

    return local
      ? cloneLocalSnapshot(
          local
        )
      : null;
  }

  function getSurveySnapshot() {
    const locals =
      survey.locals.map(
        cloneLocalSnapshot
      );

    return {
      id:
        survey.id,

      name:
        survey.name,

      reference:
        survey.reference,

      site:
        survey.site,

      building:
        survey.building,

      level:
        survey.level,

      unit:
        survey.unit,

      operatorName:
        survey.operatorName,

      surveyDate:
        survey.surveyDate,

      notes:
        survey.notes,

      displayName:
        getSurveyDisplayName(
          survey
        ),

      hasInformation:
        hasMeaningfulSurveyInformation(
          survey
        ),

      createdAt:
        survey.createdAt,

      updatedAt:
        survey.updatedAt,

      activeLocalId:
        survey.activeLocalId,

      locals,

      localCount:
        locals.length,

      itemCount:
        locals.reduce(
          (
            total,
            local
          ) =>
            total +
            local.itemCount,
          0
        ),

      totalQuantity:
        locals.reduce(
          (
            total,
            local
          ) =>
            total +
            local.totalQuantity,
          0
        ),

      completedLocalCount:
        locals.filter(
          (local) =>
            local.status ===
            SCAN_STATUS.COMPLETED
        ).length,
    };
  }

  function getPersistenceSnapshot() {
    return {
      storageKey:
        STORAGE_KEY,

      previousSurveyStorageKey:
        PREVIOUS_SURVEY_STORAGE_KEY,

      legacySessionStorageKey:
        LEGACY_SESSION_STORAGE_KEY,

      schemaVersion:
        STORAGE_SCHEMA_VERSION,

      isAvailable:
        persistenceState.isAvailable,

      hasStoredSurvey:
        persistenceState
          .hasStoredSurvey,

      hasStoredSession:
        persistenceState
          .hasStoredSession,

      wasRestored:
        persistenceState.wasRestored,

      wasMigrated:
        persistenceState.wasMigrated,

      migratedFrom:
        persistenceState.migratedFrom,

      lastSavedAt:
        persistenceState.lastSavedAt,

      lastError:
        persistenceState.lastError
          ? {
              name:
                persistenceState
                  .lastError.name,

              code:
                persistenceState
                  .lastError.code,

              message:
                persistenceState
                  .lastError.message,
            }
          : null,
    };
  }

  /* =========================================================
     RÉINITIALISATION
     ========================================================= */

  function resetSurvey() {
    survey =
      createEmptySurvey();

    pendingMergedItemUndo =
      null;

    removeStorageEntry(
      STORAGE_KEY
    );

    removeStorageEntry(
      PREVIOUS_SURVEY_STORAGE_KEY
    );

    removeStorageEntry(
      LEGACY_SESSION_STORAGE_KEY
    );

    persistenceState.hasStoredSurvey =
      false;

    persistenceState.hasStoredSession =
      false;

    persistenceState.wasRestored =
      false;

    persistenceState.wasMigrated =
      false;

    persistenceState.migratedFrom =
      null;

    persistenceState.lastSavedAt =
      null;

    return getSurveySnapshot();
  }

  function resetSession() {
    resetSurvey();

    return getSessionSnapshot();
  }

  /* =========================================================
     RECHERCHES INTERNES
     ========================================================= */

  function getActiveLocalRecord() {
    if (
      !survey.activeLocalId
    ) {
      return null;
    }

    return (
      survey.locals.find(
        (local) =>
          local.id ===
          survey.activeLocalId
      ) ?? null
    );
  }

  function requireActiveLocal() {
    const local =
      getActiveLocalRecord();

    if (!local) {
      throw createInventoryError(
        "MISSING_ACTIVE_LOCAL",
        "Un local doit être créé ou sélectionné avant de gérer l'inventaire."
      );
    }

    return local;
  }

  function findLocalById(
    localId
  ) {
    const normalizedId =
      normalizeOptionalText(
        localId,
        MAXIMUM_LENGTHS.identifier
      );

    if (!normalizedId) {
      return null;
    }

    return (
      survey.locals.find(
        (local) =>
          local.id ===
          normalizedId
      ) ?? null
    );
  }

  function findItemById(
    local,
    itemId
  ) {
    const normalizedId =
      normalizeOptionalText(
        itemId,
        MAXIMUM_LENGTHS.identifier
      );

    if (!normalizedId) {
      return null;
    }

    return (
      local.items.find(
        (item) =>
          item.id ===
          normalizedId
      ) ?? null
    );
  }

  /* =========================================================
     SAUVEGARDE
     ========================================================= */

  function markSurveyAsChanged(
    local = null,
    timestamp = null
  ) {
    const now =
      timestamp ||
      createTimestamp();

    survey.updatedAt =
      now;

    if (local) {
      local.updatedAt =
        now;
    }

    persistSurvey();
  }

  function persistSurvey() {
    if (
      !persistenceState.isAvailable
    ) {
      return false;
    }

    try {
      const savedAt =
        createTimestamp();

      const payload = {
        schemaVersion:
          STORAGE_SCHEMA_VERSION,

        application:
          "ATLAS H-ELIA",

        savedAt,

        survey:
          getSerializableSurvey(),
      };

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          payload
        )
      );

      persistenceState.hasStoredSurvey =
        true;

      persistenceState.hasStoredSession =
        survey.locals.length > 0;

      persistenceState.lastSavedAt =
        savedAt;

      persistenceState.lastError =
        null;

      return true;
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      console.error(
        "La sauvegarde du relevé a échoué. " +
          "Les données restent disponibles en mémoire.",
        error
      );

      return false;
    }
  }

  function getSerializableSurvey() {
    return {
      id:
        survey.id,

      name:
        survey.name,

      reference:
        survey.reference,

      site:
        survey.site,

      building:
        survey.building,

      level:
        survey.level,

      unit:
        survey.unit,

      operatorName:
        survey.operatorName,

      surveyDate:
        survey.surveyDate,

      notes:
        survey.notes,

      createdAt:
        survey.createdAt,

      updatedAt:
        survey.updatedAt,

      activeLocalId:
        survey.activeLocalId,

      locals:
        survey.locals.map(
          (local) => ({
            id:
              local.id,

            identifier:
              local.identifier,

            status:
              local.status,

            createdAt:
              local.createdAt,

            updatedAt:
              local.updatedAt,

            scanStartedAt:
              local.scanStartedAt,

            scanCompletedAt:
              local.scanCompletedAt,

            items:
              local.items.map(
                cloneItem
              ),
          })
        ),
    };
  }

  function removeStorageEntry(
    storageKey
  ) {
    if (
      !persistenceState.isAvailable
    ) {
      return false;
    }

    try {
      window.localStorage.removeItem(
        storageKey
      );

      return true;
    } catch (error) {
      persistenceState.lastError =
        normalizePersistenceError(error);

      console.error(
        "Une sauvegarde locale n'a pas pu être supprimée.",
        error
      );

      return false;
    }
  }

  /* =========================================================
     CLONAGE ET CALCULS
     ========================================================= */

  function cloneLocalSnapshot(
    local
  ) {
    const items =
      local.items.map(
        cloneItem
      );

    return {
      id:
        local.id,

      localId:
        local.id,

      identifier:
        local.identifier,

      localIdentifier:
        local.identifier,

      status:
        local.status,

      createdAt:
        local.createdAt,

      updatedAt:
        local.updatedAt,

      scanStartedAt:
        local.scanStartedAt,

      scanCompletedAt:
        local.scanCompletedAt,

      items,

      itemCount:
        items.length,

      totalQuantity:
        calculateLocalTotalQuantity(
          items
        ),
    };
  }

  function createEmptyLocalSnapshot() {
    return {
      id: null,
      localId: null,

      identifier: "",
      localIdentifier: "",

      status:
        SCAN_STATUS.IDLE,

      createdAt:
        survey.createdAt,

      updatedAt:
        survey.updatedAt,

      scanStartedAt:
        null,

      scanCompletedAt:
        null,

      items: [],

      itemCount:
        0,

      totalQuantity:
        0,
    };
  }

  function cloneItem(
    item
  ) {
    return {
      id:
        item.id,

      label:
        item.label,

      quantity:
        item.quantity,

      confidence:
        item.confidence,

      source:
        item.source,

      createdAt:
        item.createdAt,

      updatedAt:
        item.updatedAt,
    };
  }

  function getSurveyDisplayName(
    sourceSurvey
  ) {
    return (
      sourceSurvey.name ||
      sourceSurvey.reference ||
      sourceSurvey.site ||
      "Relevé en cours"
    );
  }

  function hasMeaningfulSurveyInformation(
    sourceSurvey
  ) {
    return Boolean(
      sourceSurvey.name ||
      sourceSurvey.reference ||
      sourceSurvey.site ||
      sourceSurvey.building ||
      sourceSurvey.level ||
      sourceSurvey.unit ||
      sourceSurvey.operatorName ||
      sourceSurvey.notes
    );
  }

  function calculateLocalTotalQuantity(
    items
  ) {
    return items.reduce(
      (
        total,
        item
      ) =>
        total +
        item.quantity,
      0
    );
  }

  function calculateSurveyTotalQuantity(
    locals
  ) {
    return locals.reduce(
      (
        total,
        local
      ) =>
        total +
        calculateLocalTotalQuantity(
          local.items
        ),
      0
    );
  }

  /* =========================================================
     NORMALISATION DES VALEURS
     ========================================================= */

  function normalizeQuantity(
    value
  ) {
    const numericValue =
      Math.trunc(
        Number(value)
      );

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return 1;
    }

    return Math.min(
      Math.max(
        numericValue,
        1
      ),
      MAXIMUM_ITEM_QUANTITY
    );
  }

  function normalizeConfidence(
    value
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return null;
    }

    return Math.min(
      Math.max(
        numericValue,
        0
      ),
      1
    );
  }

  function normalizeRequiredText(
    value,
    errorMessage,
    maximumLength
  ) {
    const normalizedValue =
      normalizeOptionalText(
        value,
        maximumLength
      );

    if (!normalizedValue) {
      throw createInventoryError(
        "REQUIRED_TEXT_MISSING",
        errorMessage
      );
    }

    return normalizedValue;
  }

  function normalizeOptionalText(
    value,
    maximumLength
  ) {
    if (
      typeof value !== "string" &&
      typeof value !== "number"
    ) {
      return "";
    }

    return String(value)
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        maximumLength
      );
  }

  function normalizeOptionalMultilineText(
    value,
    maximumLength
  ) {
    if (
      typeof value !== "string" &&
      typeof value !== "number"
    ) {
      return "";
    }

    return String(value)
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .replace(
        /[ \t]+/g,
        " "
      )
      .replace(
        /\n{3,}/g,
        "\n\n"
      )
      .trim()
      .slice(
        0,
        maximumLength
      );
  }

  function normalizeStoredDateOnly(
    value
  ) {
    const normalizedValue =
      String(
        value ?? ""
      ).trim();

    return isValidDateOnly(
      normalizedValue
    )
      ? normalizedValue
      : createLocalDateString();
  }

  function normalizeEditableDateOnly(
    value
  ) {
    const normalizedValue =
      String(
        value ?? ""
      ).trim();

    if (!normalizedValue) {
      return "";
    }

    if (
      !isValidDateOnly(
        normalizedValue
      )
    ) {
      throw createInventoryError(
        "INVALID_SURVEY_DATE",
        "La date du relevé est invalide."
      );
    }

    return normalizedValue;
  }

  function isValidDateOnly(
    value
  ) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        value
      )
    ) {
      return false;
    }

    const date =
      new Date(
        `${value}T00:00:00Z`
      );

    return (
      Number.isFinite(
        date.getTime()
      ) &&
      date
        .toISOString()
        .slice(
          0,
          10
        ) === value
    );
  }

  function normalizeTimestamp(
    value,
    fallback = null
  ) {
    if (
      typeof value ===
        "string" &&
      isValidTimestamp(
        value
      )
    ) {
      return new Date(
        value
      ).toISOString();
    }

    return (
      fallback ||
      createTimestamp()
    );
  }

  function normalizeNullableTimestamp(
    value
  ) {
    if (
      typeof value !==
        "string" ||
      !isValidTimestamp(
        value
      )
    ) {
      return null;
    }

    return new Date(
      value
    ).toISOString();
  }

  function isValidTimestamp(
    value
  ) {
    return Number.isFinite(
      Date.parse(
        value
      )
    );
  }

  function createLocalDateString() {
    const now =
      new Date();

    return [
      now.getFullYear(),

      String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getDate()
      ).padStart(
        2,
        "0"
      ),
    ].join("-");
  }

  function createTimestamp() {
    return new Date()
      .toISOString();
  }

  function createIdentifier(
    prefix
  ) {
    if (
      window.crypto &&
      typeof window.crypto
        .randomUUID ===
        "function"
    ) {
      return (
        `${prefix}-` +
        window.crypto.randomUUID()
      );
    }

    return [
      prefix,

      Date.now()
        .toString(36),

      Math.random()
        .toString(36)
        .slice(
          2,
          10
        ),
    ].join("-");
  }

  function hasOwnProperty(
    object,
    propertyName
  ) {
    return Object.prototype
      .hasOwnProperty
      .call(
        object,
        propertyName
      );
  }

  /* =========================================================
     ERREURS
     ========================================================= */

  function normalizePersistenceError(
    originalError
  ) {
    if (
      originalError?.name ===
      "HeliaInventoryError"
    ) {
      return originalError;
    }

    let code =
      "LOCAL_STORAGE_ERROR";

    let message =
      "Le navigateur n'a pas pu utiliser le stockage local.";

    if (
      originalError?.name ===
        "QuotaExceededError" ||
      originalError?.name ===
        "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      code =
        "LOCAL_STORAGE_QUOTA_EXCEEDED";

      message =
        "L'espace de stockage local disponible est insuffisant.";
    }

    const error =
      createInventoryError(
        code,
        message
      );

    error.originalError =
      originalError;

    return error;
  }

  function createInventoryError(
    code,
    message
  ) {
    const error =
      new Error(
        message
      );

    error.name =
      "HeliaInventoryError";

    error.code =
      code;

    return error;
  }

  return Object.freeze({
    SCAN_STATUS,

    setSurveyInformation,
    getSurveyInformationSnapshot,

    setSurveyName,
    getSurveySnapshot,
    resetSurvey,

    createLocal,
    selectLocal,
    renameLocal,
    removeLocal,

    getActiveLocalSnapshot,
    getLocalSnapshot,

    setLocalIdentifier,
    getSessionSnapshot,
    resetSession,

    startScan,
    stopScan,
    isScanActive,

    addItem,
    updateItemQuantity,
    removeItem,

    getPersistenceSnapshot,
  });
})();