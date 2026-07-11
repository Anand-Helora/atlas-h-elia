"use strict";

/**
 * Partage des exports d'ATLAS H-ELIA.
 *
 * Ce module :
 * - génère un fichier CSV ;
 * - génère un fichier JSON ;
 * - vérifie si le navigateur peut partager les fichiers ;
 * - ouvre le menu de partage natif du téléphone ;
 * - ne télécharge rien automatiquement ;
 * - ne prétend pas que l'e-mail a été envoyé :
 *   l'utilisateur choisit lui-même l'application cible.
 */
window.HeliaShare = (() => {
  const APPLICATION_NAME =
    "ATLAS H-ELIA";

  const CSV_MIME_TYPE =
    "text/csv;charset=utf-8";

  const JSON_MIME_TYPE =
    "application/json;charset=utf-8";

  const CSV_SEPARATOR =
    ";";

  const CSV_UTF8_BOM =
    "\uFEFF";

  const MAXIMUM_FILENAME_LENGTH =
    90;

  /**
   * Vérifie les dépendances nécessaires.
   */
  function validateDependencies() {
    if (!window.HeliaInventory) {
      throw createShareError(
        "MISSING_INVENTORY_MODULE",
        "HeliaInventory doit être chargé avant share.js."
      );
    }
  }

  /**
   * Génère les deux fichiers du relevé.
   *
   * @returns {{
   *   survey: Object,
   *   files: File[],
   *   csvFile: File,
   *   jsonFile: File
   * }}
   */
  function createSurveyFiles() {
    validateDependencies();

    if (
      typeof window.File !==
      "function"
    ) {
      throw createShareError(
        "FILE_API_UNAVAILABLE",
        "Ce navigateur ne permet pas de créer les fichiers à partager."
      );
    }

    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    validateSurvey(
      survey
    );

    const filenameBase =
      createFilenameBase(
        survey
      );

    const csvContent =
      createSurveyCsv(
        survey
      );

    const jsonContent =
      createSurveyJson(
        survey
      );

    const lastModified =
      Date.now();

    const csvFile =
      new File(
        [
          CSV_UTF8_BOM,
          csvContent,
        ],
        `${filenameBase}.csv`,
        {
          type:
            CSV_MIME_TYPE,

          lastModified,
        }
      );

    const jsonFile =
      new File(
        [
          jsonContent,
        ],
        `${filenameBase}.json`,
        {
          type:
            JSON_MIME_TYPE,

          lastModified,
        }
      );

    return {
      survey,

      files: [
        csvFile,
        jsonFile,
      ],

      csvFile,
      jsonFile,
    };
  }

  /**
   * Vérifie que le relevé peut être partagé.
   *
   * @param {Object} survey Relevé.
   */
  function validateSurvey(
    survey
  ) {
    if (
      !survey ||
      typeof survey !==
        "object"
    ) {
      throw createShareError(
        "INVALID_SURVEY",
        "Le relevé est introuvable ou invalide."
      );
    }

    if (
      !Array.isArray(
        survey.locals
      )
    ) {
      throw createShareError(
        "INVALID_SURVEY_LOCALS",
        "La liste des locaux du relevé est invalide."
      );
    }

    if (
      survey.locals.length ===
      0
    ) {
      throw createShareError(
        "EMPTY_SURVEY",
        "Ajoutez au moins un local avant de partager le relevé."
      );
    }
  }

  /**
   * Vérifie si le partage de fichiers
   * est disponible sur l'appareil.
   *
   * @param {File[]|null} files Fichiers à tester.
   * @returns {{
   *   available: boolean,
   *   code: string,
   *   message: string
   * }}
   */
  function getAvailability(
    files = null
  ) {
    if (
      !window.isSecureContext
    ) {
      return {
        available:
          false,

        code:
          "INSECURE_CONTEXT",

        message:
          "Le partage nécessite une connexion HTTPS sécurisée.",
      };
    }

    if (
      typeof navigator.share !==
      "function"
    ) {
      return {
        available:
          false,

        code:
          "SHARE_API_UNAVAILABLE",

        message:
          "Le partage de fichiers n'est pas disponible dans ce navigateur.",
      };
    }

    if (
      typeof navigator.canShare !==
      "function"
    ) {
      return {
        available:
          false,

        code:
          "CAN_SHARE_UNAVAILABLE",

        message:
          "Ce navigateur ne permet pas de vérifier le partage des pièces jointes.",
      };
    }

    let testedFiles =
      files;

    if (!testedFiles) {
      try {
        testedFiles =
          createSurveyFiles()
            .files;
      } catch (error) {
        return {
          available:
            false,

          code:
            error?.code ||
            "FILE_CREATION_FAILED",

          message:
            error?.message ||
            "Les fichiers du relevé n'ont pas pu être préparés.",
        };
      }
    }

    try {
      const canShareFiles =
        navigator.canShare({
          files:
            testedFiles,
        });

      if (!canShareFiles) {
        return {
          available:
            false,

          code:
            "FILE_SHARING_UNSUPPORTED",

          message:
            "Cet appareil ne permet pas de partager ces fichiers en pièces jointes.",
        };
      }
    } catch (error) {
      console.error(
        "Erreur pendant la vérification du partage :",
        error
      );

      return {
        available:
          false,

        code:
          "FILE_SHARING_CHECK_FAILED",

        message:
          "La compatibilité du partage n'a pas pu être vérifiée.",
      };
    }

    return {
      available:
        true,

      code:
        "AVAILABLE",

      message:
        "Le partage des fichiers est disponible.",
    };
  }

  /**
   * Ouvre le menu de partage natif.
   *
   * Cette fonction doit être appelée directement
   * à la suite d'un clic utilisateur.
   *
   * @returns {Promise<{
   *   status: "handed-off"|"cancelled",
   *   filenames: string[]
   * }>}
   */
  async function shareSurveyFiles() {
    const filePackage =
      createSurveyFiles();

    const availability =
      getAvailability(
        filePackage.files
      );

    if (
      !availability.available
    ) {
      throw createShareError(
        availability.code,
        availability.message
      );
    }

    const shareData = {
      title:
        createShareTitle(
          filePackage.survey
        ),

      text:
        createShareText(
          filePackage.survey
        ),

      files:
        filePackage.files,
    };

    try {
      await navigator.share(
        shareData
      );

      /*
       * Le navigateur a transmis les fichiers
       * à la destination choisie.
       *
       * Cela ne garantit pas que l'utilisateur
       * a effectivement envoyé un e-mail.
       */
      return {
        status:
          "handed-off",

        filenames:
          filePackage.files.map(
            (file) =>
              file.name
          ),
      };
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return {
          status:
            "cancelled",

          filenames:
            filePackage.files.map(
              (file) =>
                file.name
            ),
        };
      }

      console.error(
        "Erreur durant le partage du relevé :",
        error
      );

      throw createShareError(
        "SHARE_FAILED",
        createShareFailureMessage(
          error
        ),
        error
      );
    }
  }

  /**
   * Génère le contenu JSON.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createSurveyJson(
    survey
  ) {
    try {
      return JSON.stringify(
        survey,
        null,
        2
      );
    } catch (error) {
      throw createShareError(
        "JSON_CREATION_FAILED",
        "Le fichier JSON n'a pas pu être généré.",
        error
      );
    }
  }

  /**
   * Génère le contenu CSV.
   *
   * Une ligne correspond à un objet.
   * Un local vide reçoit également une ligne.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createSurveyCsv(
    survey
  ) {
    const rows = [
      [
        "Nom du relevé",
        "Référence",
        "Site",
        "Bâtiment",
        "Niveau",
        "Unité ou service",
        "Opérateur",
        "Date du relevé",
        "Notes",
        "Local",
        "Statut du local",
        "Objet",
        "Quantité",
        "Source",
        "Confiance IA",
      ],
    ];

    survey.locals.forEach(
      (local) => {
        const items =
          Array.isArray(
            local.items
          )
            ? local.items
            : [];

        if (
          items.length ===
          0
        ) {
          rows.push(
            createCsvRow({
              survey,
              local,
              item:
                null,
            })
          );

          return;
        }

        items.forEach(
          (item) => {
            rows.push(
              createCsvRow({
                survey,
                local,
                item,
              })
            );
          }
        );
      }
    );

    return rows
      .map(
        (row) =>
          row
            .map(
              escapeCsvCell
            )
            .join(
              CSV_SEPARATOR
            )
      )
      .join(
        "\r\n"
      );
  }

  /**
   * Crée une ligne du CSV.
   *
   * @param {Object} options Paramètres.
   * @returns {Array<unknown>}
   */
  function createCsvRow({
    survey,
    local,
    item,
  }) {
    return [
      survey.name ||
        survey.displayName ||
        "",

      survey.reference ||
        "",

      survey.site ||
        "",

      survey.building ||
        "",

      survey.level ||
        "",

      survey.unit ||
        "",

      survey.operatorName ||
        "",

      survey.surveyDate ||
        "",

      survey.notes ||
        "",

      local.identifier ||
        "",

      formatLocalStatus(
        local.status
      ),

      item?.label ||
        "",

      item
        ? normalizeQuantity(
            item.quantity
          )
        : "",

      item
        ? formatItemSource(
            item
          )
        : "",

      item
        ? formatConfidence(
            item.confidence
          )
        : "",
    ];
  }

  /**
   * Protège et échappe une cellule CSV.
   *
   * La protection contre les formules
   * évite qu'une valeur commençant par
   * =, +, - ou @ soit exécutée par Excel.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function escapeCsvCell(
    value
  ) {
    let text =
      String(
        value ?? ""
      );

    if (
      /^[\s]*[=+\-@]/.test(
        text
      )
    ) {
      text =
        `'${text}`;
    }

    const escapedText =
      text.replace(
        /"/g,
        '""'
      );

    return `"${escapedText}"`;
  }

  /**
   * Formate la confiance IA.
   *
   * @param {unknown} confidence Confiance entre 0 et 1.
   * @returns {string}
   */
  function formatConfidence(
    confidence
  ) {
    if (
      confidence ===
        null ||
      confidence ===
        undefined ||
      confidence ===
        ""
    ) {
      return "";
    }

    const numericConfidence =
      Number(
        confidence
      );

    if (
      !Number.isFinite(
        numericConfidence
      )
    ) {
      return "";
    }

    const percentage =
      Math.min(
        100,
        Math.max(
          0,
          numericConfidence *
            100
        )
      );

    return (
      percentage
        .toFixed(1)
        .replace(
          ".",
          ","
        ) +
      " %"
    );
  }

  /**
   * Formate la source d'un objet.
   *
   * @param {Object} item Objet.
   * @returns {string}
   */
  function formatItemSource(
    item
  ) {
    if (
      item.source ===
      "manual"
    ) {
      return "Ajout manuel";
    }

    if (
      item.confidence ===
      null
    ) {
      return "Ajout manuel";
    }

    return "Reconnaissance IA";
  }

  /**
   * Formate l'état d'un local.
   *
   * @param {unknown} status État.
   * @returns {string}
   */
  function formatLocalStatus(
    status
  ) {
    const labels = {
      idle:
        "Non commencé",

      ready:
        "Prêt à scanner",

      scanning:
        "Scan en cours",

      paused:
        "En pause",

      completed:
        "Terminé",
    };

    return (
      labels[status] ||
      String(
        status ?? ""
      )
    );
  }

  /**
   * Normalise une quantité.
   *
   * @param {unknown} value Quantité.
   * @returns {number}
   */
  function normalizeQuantity(
    value
  ) {
    const numericValue =
      Number(
        value
      );

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.trunc(
        numericValue
      )
    );
  }

  /**
   * Crée le nom commun des fichiers.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createFilenameBase(
    survey
  ) {
    const surveyName =
      survey.name ||
      survey.displayName ||
      survey.reference ||
      "releve";

    const date =
      survey.surveyDate ||
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );

    const normalizedName =
      normalizeFilenamePart(
        surveyName
      );

    const normalizedDate =
      normalizeFilenamePart(
        date
      );

    const filename =
      [
        "atlas-h-elia",
        normalizedName,
        normalizedDate,
      ]
        .filter(
          Boolean
        )
        .join(
          "-"
        )
        .slice(
          0,
          MAXIMUM_FILENAME_LENGTH
        )
        .replace(
          /-+$/g,
          ""
        );

    return (
      filename ||
      "atlas-h-elia-releve"
    );
  }

  /**
   * Nettoie une partie de nom de fichier.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function normalizeFilenamePart(
    value
  ) {
    return String(
      value ?? ""
    )
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLocaleLowerCase(
        "fr"
      )
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );
  }

  /**
   * Crée le titre du partage.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createShareTitle(
    survey
  ) {
    const surveyName =
      survey.name ||
      survey.displayName ||
      "Relevé";

    return (
      `${APPLICATION_NAME} — ` +
      surveyName
    );
  }

  /**
   * Crée le texte accompagnant les pièces jointes.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createShareText(
    survey
  ) {
    const surveyName =
      survey.name ||
      survey.displayName ||
      "Relevé sans nom";

    const localCount =
      Array.isArray(
        survey.locals
      )
        ? survey.locals.length
        : 0;

    const objectCount =
      calculateTotalQuantity(
        survey
      );

    return (
      `Relevé « ${surveyName} » généré avec ${APPLICATION_NAME}. ` +
      `${formatLocalCount(localCount)}, ` +
      `${formatObjectCount(objectCount)}. ` +
      "Les exports CSV et JSON sont joints."
    );
  }

  /**
   * Calcule le nombre total d'objets.
   *
   * @param {Object} survey Relevé.
   * @returns {number}
   */
  function calculateTotalQuantity(
    survey
  ) {
    return survey.locals.reduce(
      (
        surveyTotal,
        local
      ) => {
        const items =
          Array.isArray(
            local.items
          )
            ? local.items
            : [];

        const localTotal =
          items.reduce(
            (
              itemTotal,
              item
            ) =>
              itemTotal +
              normalizeQuantity(
                item.quantity
              ),
            0
          );

        return (
          surveyTotal +
          localTotal
        );
      },
      0
    );
  }

  /**
   * Formate le nombre de locaux.
   *
   * @param {number} count Nombre.
   * @returns {string}
   */
  function formatLocalCount(
    count
  ) {
    if (count === 0) {
      return "aucun local";
    }

    if (count === 1) {
      return "1 local";
    }

    return `${count} locaux`;
  }

  /**
   * Formate le nombre d'objets.
   *
   * @param {number} count Nombre.
   * @returns {string}
   */
  function formatObjectCount(
    count
  ) {
    if (count === 0) {
      return "aucun objet";
    }

    if (count === 1) {
      return "1 objet";
    }

    return `${count} objets`;
  }

  /**
   * Crée un message d'erreur adapté.
   *
   * @param {Error} error Erreur native.
   * @returns {string}
   */
  function createShareFailureMessage(
    error
  ) {
    if (
      error?.name ===
      "NotAllowedError"
    ) {
      return (
        "Le partage a été refusé par le navigateur. " +
        "Réessayez en cliquant directement sur le bouton de partage."
      );
    }

    if (
      error?.name ===
      "InvalidStateError"
    ) {
      return (
        "Le menu de partage est déjà ouvert ou l'application n'est pas active."
      );
    }

    if (
      error?.name ===
      "DataError"
    ) {
      return (
        "Les fichiers n'ont pas été acceptés par le système de partage."
      );
    }

    return (
      "Le relevé n'a pas pu être partagé. " +
      "Les exports CSV et JSON restent disponibles séparément."
    );
  }

  /**
   * Crée une erreur identifiable.
   *
   * @param {string} code Code.
   * @param {string} message Message.
   * @param {unknown} cause Cause initiale.
   * @returns {Error}
   */
  function createShareError(
    code,
    message,
    cause = null
  ) {
    const error =
      new Error(
        message
      );

    error.name =
      "HeliaShareError";

    error.code =
      code;

    if (cause) {
      error.cause =
        cause;
    }

    return error;
  }

  return Object.freeze({
    createSurveyFiles,
    getAvailability,
    shareSurveyFiles,
  });
})();