"use strict";

/**
 * Gestion des exports d'ATLAS H-ELIA.
 *
 * Cette version exporte :
 * - les informations générales du relevé ;
 * - tous les locaux ;
 * - tous les objets ;
 * - les locaux ne contenant encore aucun objet.
 */
window.HeliaExport = (() => {
  const CSV_SEPARATOR = ";";

  const CSV_MIME_TYPE =
    "text/csv;charset=utf-8";

  const JSON_MIME_TYPE =
    "application/json;charset=utf-8";

  const EXPORT_FORMAT_VERSION = 3;

  /**
   * Exporte le relevé complet au format CSV.
   *
   * @param {Object|null} suppliedSurvey Relevé facultatif.
   * @returns {Object}
   */
  function exportSurveyCsv(
    suppliedSurvey = null
  ) {
    const survey =
      getValidatedSurvey(
        suppliedSurvey
      );

    const csvContent =
      createSurveyCsvContent(
        survey
      );

    const filename =
      createSurveyFilename(
        survey,
        "csv"
      );

    /*
     * Le BOM UTF-8 aide Excel à reconnaître correctement
     * les accents et les caractères français.
     */
    downloadTextFile({
      content:
        `\uFEFF${csvContent}`,

      filename,

      mimeType:
        CSV_MIME_TYPE,
    });

    return createExportResult({
      survey,
      filename,
      format: "csv",
    });
  }

  /**
   * Exporte le relevé complet au format JSON.
   *
   * @param {Object|null} suppliedSurvey Relevé facultatif.
   * @returns {Object}
   */
  function exportSurveyJson(
    suppliedSurvey = null
  ) {
    const survey =
      getValidatedSurvey(
        suppliedSurvey
      );

    const exportPayload = {
      exportInformation: {
        application:
          getApplicationName(),

        applicationVersion:
          window.HELIA_CONFIG
            ?.application
            ?.version ??
          null,

        exportedAt:
          new Date()
            .toISOString(),

        formatVersion:
          EXPORT_FORMAT_VERSION,

        contentType:
          "atlas-h-elia-multi-local-survey",
      },

      survey,
    };

    const jsonContent =
      JSON.stringify(
        exportPayload,
        null,
        2
      );

    const filename =
      createSurveyFilename(
        survey,
        "json"
      );

    downloadTextFile({
      content:
        jsonContent,

      filename,

      mimeType:
        JSON_MIME_TYPE,
    });

    return createExportResult({
      survey,
      filename,
      format: "json",
    });
  }

  /**
   * Ancien nom conservé pour compatibilité.
   *
   * @param {Object|null} suppliedSurvey Relevé facultatif.
   * @returns {Object}
   */
  function exportCsv(
    suppliedSurvey = null
  ) {
    return exportSurveyCsv(
      suppliedSurvey
    );
  }

  /**
   * Ancien nom conservé pour compatibilité.
   *
   * @param {Object|null} suppliedSurvey Relevé facultatif.
   * @returns {Object}
   */
  function exportJson(
    suppliedSurvey = null
  ) {
    return exportSurveyJson(
      suppliedSurvey
    );
  }

  /**
   * Crée le contenu CSV du relevé.
   *
   * Une ligne est produite pour chaque objet.
   * Un local vide produit également une ligne.
   *
   * @param {Object} suppliedSurvey Relevé.
   * @returns {string}
   */
  function createSurveyCsvContent(
    suppliedSurvey
  ) {
    const survey =
      getValidatedSurvey(
        suppliedSurvey
      );

    const headers = [
      "Relevé ID",
      "Nom du relevé",
      "Référence",
      "Site",
      "Bâtiment",
      "Étage ou niveau",
      "Unité ou service",
      "Opérateur",
      "Date du relevé",
      "Notes",

      "Local ID",
      "Local",
      "Statut du local",

      "Objet ID",
      "Objet",
      "Quantité",
      "Confiance IA (%)",
      "Source",

      "Objet créé le",
      "Objet modifié le",
    ];

    const rows =
      createSurveyCsvRows(
        survey
      );

    return [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escapeCsvValue)
          .join(CSV_SEPARATOR)
      )
      .join("\r\n");
  }

  /**
   * Ancien nom conservé pour compatibilité.
   *
   * @param {Object} suppliedSurvey Relevé.
   * @returns {string}
   */
  function createCsvContent(
    suppliedSurvey
  ) {
    return createSurveyCsvContent(
      suppliedSurvey
    );
  }

  /**
   * Crée toutes les lignes CSV.
   *
   * @param {Object} survey Relevé.
   * @returns {Array<Array<unknown>>}
   */
  function createSurveyCsvRows(
    survey
  ) {
    const rows = [];

    survey.locals.forEach(
      (local) => {
        if (
          local.items.length === 0
        ) {
          rows.push(
            createEmptyLocalCsvRow(
              survey,
              local
            )
          );

          return;
        }

        local.items.forEach(
          (item) => {
            rows.push(
              createItemCsvRow(
                survey,
                local,
                item
              )
            );
          }
        );
      }
    );

    return rows;
  }

  /**
   * Crée les colonnes communes au relevé.
   *
   * @param {Object} survey Relevé.
   * @returns {Array<unknown>}
   */
  function createSurveyColumns(
    survey
  ) {
    return [
      survey.id,
      survey.name,
      survey.reference,
      survey.site,
      survey.building,
      survey.level,
      survey.unit,
      survey.operatorName,
      survey.surveyDate,
      survey.notes,
    ];
  }

  /**
   * Crée une ligne CSV correspondant à un objet.
   *
   * @param {Object} survey Relevé.
   * @param {Object} local Local.
   * @param {Object} item Objet.
   * @returns {Array<unknown>}
   */
  function createItemCsvRow(
    survey,
    local,
    item
  ) {
    return [
      ...createSurveyColumns(
        survey
      ),

      local.id,
      local.identifier,
      formatLocalStatus(
        local.status
      ),

      item.id,
      item.label,
      item.quantity,

      item.confidence === null
        ? ""
        : formatConfidence(
            item.confidence
          ),

      item.source,

      item.createdAt,
      item.updatedAt,
    ];
  }

  /**
   * Crée une ligne pour un local vide.
   *
   * @param {Object} survey Relevé.
   * @param {Object} local Local.
   * @returns {Array<unknown>}
   */
  function createEmptyLocalCsvRow(
    survey,
    local
  ) {
    return [
      ...createSurveyColumns(
        survey
      ),

      local.id,
      local.identifier,
      formatLocalStatus(
        local.status
      ),

      "",
      "",
      0,
      "",
      "",
      "",
      "",
    ];
  }

  /**
   * Retourne et valide le relevé à exporter.
   *
   * @param {Object|null} suppliedSurvey Relevé fourni.
   * @returns {Object}
   */
  function getValidatedSurvey(
    suppliedSurvey
  ) {
    let sourceSurvey =
      suppliedSurvey;

    if (!sourceSurvey) {
      if (
        !window.HeliaInventory ||
        typeof window
          .HeliaInventory
          .getSurveySnapshot !==
          "function"
      ) {
        throw createExportError(
          "MISSING_INVENTORY_MODULE",
          "Le module d'inventaire multi-local est indisponible."
        );
      }

      sourceSurvey =
        window.HeliaInventory
          .getSurveySnapshot();
    }

    if (
      !sourceSurvey ||
      typeof sourceSurvey !==
        "object" ||
      Array.isArray(sourceSurvey)
    ) {
      throw createExportError(
        "INVALID_SURVEY",
        "Le relevé à exporter est invalide."
      );
    }

    if (
      !Array.isArray(
        sourceSurvey.locals
      )
    ) {
      throw createExportError(
        "INVALID_LOCAL_LIST",
        "La liste des locaux du relevé est invalide."
      );
    }

    if (
      sourceSurvey.locals.length ===
      0
    ) {
      throw createExportError(
        "EMPTY_SURVEY",
        "Le relevé ne contient aucun local à exporter."
      );
    }

    const locals =
      sourceSurvey.locals.map(
        normalizeLocalForExport
      );

    const survey = {
      id:
        normalizeText(
          sourceSurvey.id
        ) ||
        "survey",

      name:
        normalizeText(
          sourceSurvey.name
        ),

      reference:
        normalizeText(
          sourceSurvey.reference
        ),

      site:
        normalizeText(
          sourceSurvey.site
        ),

      building:
        normalizeText(
          sourceSurvey.building
        ),

      level:
        normalizeText(
          sourceSurvey.level
        ),

      unit:
        normalizeText(
          sourceSurvey.unit
        ),

      operatorName:
        normalizeText(
          sourceSurvey.operatorName
        ),

      surveyDate:
        normalizeDateOnly(
          sourceSurvey.surveyDate
        ),

      notes:
        normalizeMultilineText(
          sourceSurvey.notes
        ),

      displayName:
        normalizeText(
          sourceSurvey.displayName
        ),

      createdAt:
        normalizeNullableText(
          sourceSurvey.createdAt
        ),

      updatedAt:
        normalizeNullableText(
          sourceSurvey.updatedAt
        ),

      activeLocalId:
        normalizeNullableText(
          sourceSurvey.activeLocalId
        ),

      locals,
    };

    survey.displayName =
      getSurveyDisplayName(
        survey
      );

    survey.localCount =
      locals.length;

    survey.itemCount =
      locals.reduce(
        (total, local) =>
          total +
          local.itemCount,
        0
      );

    survey.totalQuantity =
      locals.reduce(
        (total, local) =>
          total +
          local.totalQuantity,
        0
      );

    survey.completedLocalCount =
      locals.filter(
        (local) =>
          local.status ===
          "completed"
      ).length;

    return survey;
  }

  /**
   * Normalise un local.
   *
   * @param {Object} sourceLocal Local brut.
   * @param {number} index Position.
   * @returns {Object}
   */
  function normalizeLocalForExport(
    sourceLocal,
    index
  ) {
    if (
      !sourceLocal ||
      typeof sourceLocal !==
        "object" ||
      Array.isArray(sourceLocal)
    ) {
      throw createExportError(
        "INVALID_LOCAL",
        `Le local situé à la position ${index + 1} est invalide.`
      );
    }

    const identifier =
      normalizeText(
        sourceLocal.identifier ??
          sourceLocal.localIdentifier
      );

    if (!identifier) {
      throw createExportError(
        "MISSING_LOCAL_IDENTIFIER",
        `Le local situé à la position ${index + 1} ne possède pas d'identifiant.`
      );
    }

    const items =
      Array.isArray(
        sourceLocal.items
      )
        ? sourceLocal.items.map(
            normalizeItemForExport
          )
        : [];

    return {
      id:
        normalizeText(
          sourceLocal.id ??
            sourceLocal.localId
        ) ||
        `local-${index + 1}`,

      identifier,

      status:
        normalizeText(
          sourceLocal.status
        ) ||
        "ready",

      createdAt:
        normalizeNullableText(
          sourceLocal.createdAt
        ),

      updatedAt:
        normalizeNullableText(
          sourceLocal.updatedAt
        ),

      scanStartedAt:
        normalizeNullableText(
          sourceLocal.scanStartedAt
        ),

      scanCompletedAt:
        normalizeNullableText(
          sourceLocal.scanCompletedAt
        ),

      items,

      itemCount:
        items.length,

      totalQuantity:
        items.reduce(
          (total, item) =>
            total +
            item.quantity,
          0
        ),
    };
  }

  /**
   * Normalise un objet.
   *
   * @param {Object} sourceItem Objet brut.
   * @param {number} index Position.
   * @returns {Object}
   */
  function normalizeItemForExport(
    sourceItem,
    index
  ) {
    if (
      !sourceItem ||
      typeof sourceItem !==
        "object" ||
      Array.isArray(sourceItem)
    ) {
      throw createExportError(
        "INVALID_ITEM",
        `Un objet situé à la position ${index + 1} est invalide.`
      );
    }

    const label =
      normalizeText(
        sourceItem.label
      );

    if (!label) {
      throw createExportError(
        "MISSING_ITEM_LABEL",
        `Un objet situé à la position ${index + 1} ne possède pas de nom.`
      );
    }

    return {
      id:
        normalizeText(
          sourceItem.id
        ) ||
        `item-${index + 1}`,

      label,

      quantity:
        normalizeQuantity(
          sourceItem.quantity
        ),

      confidence:
        normalizeConfidence(
          sourceItem.confidence
        ),

      source:
        normalizeText(
          sourceItem.source
        ) ||
        "unknown",

      createdAt:
        normalizeNullableText(
          sourceItem.createdAt
        ),

      updatedAt:
        normalizeNullableText(
          sourceItem.updatedAt
        ),
    };
  }

  /**
   * Retourne le nom affiché du relevé.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function getSurveyDisplayName(
    survey
  ) {
    return (
      survey.name ||
      survey.reference ||
      survey.site ||
      survey.displayName ||
      "Relevé en cours"
    );
  }

  /**
   * Formate le statut d'un local.
   *
   * @param {string} status Statut.
   * @returns {string}
   */
  function formatLocalStatus(
    status
  ) {
    switch (status) {
      case "scanning":
        return "Scan en cours";

      case "paused":
        return "À reprendre";

      case "completed":
        return "Terminé";

      case "ready":
        return "Prêt à scanner";

      case "idle":
        return "Non commencé";

      default:
        return (
          normalizeText(status) ||
          "Inconnu"
        );
    }
  }

  /**
   * Formate une confiance entre 0 et 1.
   *
   * @param {number} confidence Confiance.
   * @returns {string}
   */
  function formatConfidence(
    confidence
  ) {
    const numericValue =
      Number(confidence);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return "";
    }

    const boundedValue =
      Math.min(
        Math.max(
          numericValue,
          0
        ),
        1
      );

    return (
      Math.round(
        boundedValue * 1000
      ) / 10
    )
      .toFixed(1)
      .replace(".", ",");
  }

  /**
   * Protège et échappe une valeur CSV.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function escapeCsvValue(value) {
    const text =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    const protectedText =
      protectSpreadsheetFormula(
        text
      );

    const escapedText =
      protectedText.replace(
        /"/g,
        '""'
      );

    const requiresQuotes =
      escapedText.includes(
        CSV_SEPARATOR
      ) ||
      escapedText.includes('"') ||
      escapedText.includes("\n") ||
      escapedText.includes("\r");

    return requiresQuotes
      ? `"${escapedText}"`
      : escapedText;
  }

  /**
   * Empêche Excel d'interpréter une valeur comme formule.
   *
   * @param {string} value Texte.
   * @returns {string}
   */
  function protectSpreadsheetFormula(
    value
  ) {
    if (!value) {
      return "";
    }

    const firstCharacter =
      value
        .trimStart()
        .charAt(0);

    if (
      ["=", "+", "-", "@"].includes(
        firstCharacter
      )
    ) {
      return `'${value}`;
    }

    return value;
  }

  /**
   * Crée le résultat retourné après téléchargement.
   *
   * @param {Object} options Paramètres.
   * @returns {Object}
   */
  function createExportResult({
    survey,
    filename,
    format,
  }) {
    return {
      filename,
      format,

      surveyId:
        survey.id,

      surveyName:
        getSurveyDisplayName(
          survey
        ),

      reference:
        survey.reference,

      site:
        survey.site,

      localCount:
        survey.localCount,

      itemCount:
        survey.itemCount,

      totalQuantity:
        survey.totalQuantity,
    };
  }

  /**
   * Crée le nom du fichier d'export.
   *
   * @param {Object} survey Relevé.
   * @param {string} extension Extension.
   * @returns {string}
   */
  function createSurveyFilename(
    survey,
    extension
  ) {
    const mainIdentifier =
      survey.name ||
      survey.reference ||
      survey.site ||
      "releve";

    const safeIdentifier =
      sanitizeFilenamePart(
        mainIdentifier
      ) ||
      "releve";

    const timestamp =
      createFilenameTimestamp();

    return (
      "atlas-h-elia_" +
      `${safeIdentifier}_` +
      `${timestamp}.` +
      extension
    );
  }

  /**
   * Ancienne fonction conservée pour compatibilité.
   *
   * @param {string} name Nom.
   * @param {string} extension Extension.
   * @returns {string}
   */
  function createFilename(
    name,
    extension
  ) {
    const safeName =
      sanitizeFilenamePart(
        name
      ) ||
      "releve";

    return (
      "atlas-h-elia_" +
      `${safeName}_` +
      `${createFilenameTimestamp()}.` +
      extension
    );
  }

  /**
   * Nettoie une partie du nom de fichier.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function sanitizeFilenamePart(
    value
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^[-_]+|[-_]+$/g,
        ""
      )
      .slice(0, 80)
      .toLowerCase();
  }

  /**
   * Crée une date adaptée à un nom de fichier.
   *
   * @returns {string}
   */
  function createFilenameTimestamp() {
    const now =
      new Date();

    return [
      now.getFullYear(),

      padNumber(
        now.getMonth() + 1
      ),

      padNumber(
        now.getDate()
      ),
    ].join("-") +
      "_" +
      [
        padNumber(
          now.getHours()
        ),

        padNumber(
          now.getMinutes()
        ),

        padNumber(
          now.getSeconds()
        ),
      ].join("");
  }

  /**
   * Complète un nombre avec un zéro.
   *
   * @param {number} value Nombre.
   * @returns {string}
   */
  function padNumber(value) {
    return String(value)
      .padStart(2, "0");
  }

  /**
   * Retourne le nom complet de l'application.
   *
   * @returns {string}
   */
  function getApplicationName() {
    const application =
      window.HELIA_CONFIG
        ?.application;

    if (!application) {
      return "ATLAS H-ELIA";
    }

    if (application.fullName) {
      return application.fullName;
    }

    const prefix =
      normalizeText(
        application.prefix
      );

    const moduleName =
      normalizeText(
        application.moduleName
      );

    if (
      prefix &&
      moduleName
    ) {
      return (
        `${prefix}-` +
        moduleName
      );
    }

    return "ATLAS H-ELIA";
  }

  /**
   * Normalise une quantité.
   *
   * @param {unknown} value Valeur.
   * @returns {number}
   */
  function normalizeQuantity(value) {
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
      999
    );
  }

  /**
   * Normalise une confiance.
   *
   * @param {unknown} value Valeur.
   * @returns {number|null}
   */
  function normalizeConfidence(value) {
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

  /**
   * Normalise une date YYYY-MM-DD.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function normalizeDateOnly(value) {
    const normalizedValue =
      normalizeText(value);

    if (!normalizedValue) {
      return "";
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        normalizedValue
      )
    ) {
      return normalizedValue;
    }

    return normalizedValue;
  }

  /**
   * Normalise un texte sur une ligne.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function normalizeText(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Normalise un texte multiligne.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function normalizeMultilineText(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();
  }

  /**
   * Normalise un texte facultatif.
   *
   * @param {unknown} value Valeur.
   * @returns {string|null}
   */
  function normalizeNullableText(value) {
    const normalizedValue =
      normalizeText(value);

    return normalizedValue || null;
  }

  /**
   * Déclenche le téléchargement.
   *
   * @param {Object} options Paramètres.
   */
  function downloadTextFile({
    content,
    filename,
    mimeType,
  }) {
    if (
      typeof Blob ===
        "undefined" ||
      typeof URL ===
        "undefined" ||
      typeof URL.createObjectURL !==
        "function"
    ) {
      throw createExportError(
        "DOWNLOAD_NOT_SUPPORTED",
        "Ce navigateur ne permet pas de télécharger le fichier."
      );
    }

    const blob =
      new Blob(
        [content],
        {
          type: mimeType,
        }
      );

    const objectUrl =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = objectUrl;
    link.download = filename;
    link.hidden = true;

    document.body.append(
      link
    );

    try {
      link.click();
    } finally {
      link.remove();

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            objectUrl
          );
        },
        1000
      );
    }
  }

  /**
   * Crée une erreur d'export.
   *
   * @param {string} code Code.
   * @param {string} message Message.
   * @returns {Error}
   */
  function createExportError(
    code,
    message
  ) {
    const error =
      new Error(message);

    error.name =
      "HeliaExportError";

    error.code = code;

    return error;
  }

  return Object.freeze({
    exportSurveyCsv,
    exportSurveyJson,

    exportCsv,
    exportJson,

    createSurveyCsvContent,
    createCsvContent,

    createSurveyFilename,
    createFilename,
  });
})();