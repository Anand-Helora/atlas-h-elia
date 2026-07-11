"use strict";

/**
 * Interface utilisateur d'ATLAS H-ELIA.
 *
 * Structure fonctionnelle :
 * - un relevé possède des informations générales ;
 * - un relevé contient plusieurs locaux ;
 * - chaque local contient plusieurs objets ;
 * - l'IA propose les objets, mais l'utilisateur les valide.
 */
window.HeliaUI = (() => {
  let appElement = null;

  let cameraErrorMessage = "";
  let summaryFeedbackMessage = "";
  let surveyInformationFormIsOpen = false;

  /*
   * Gestion de la boucle de reconnaissance.
   */
  let predictionTimerId = null;
  let predictionLoopGeneration = 0;
  let predictionInProgress = false;

  /*
   * État de l'interaction pendant le scan.
   */
  let latestAnalysisResult = null;
  let selectedPrediction = null;

  let scanPausedForConfirmation = false;
  let quantityModeIsOpen = false;

  let selectedQuantity = 1;
  let lastAddedItemId = null;

  /**
   * Initialise l'interface.
   *
   * @param {string} appElementId Conteneur principal.
   */
  function initialize(appElementId = "app") {
    validateDependencies();

    appElement =
      document.getElementById(
        appElementId
      );

    if (!appElement) {
      throw new Error(
        `Le conteneur principal #${appElementId} est introuvable.`
      );
    }

    applyTheme();
  }

  /**
   * Vérifie les dépendances de l'interface.
   */
  function validateDependencies() {
    const missingModules = [];

    if (!window.HELIA_CONFIG) {
      missingModules.push(
        "HELIA_CONFIG"
      );
    }

    if (!window.HELIA_SCREENS) {
      missingModules.push(
        "HELIA_SCREENS"
      );
    }

    if (!window.HeliaNavigation) {
      missingModules.push(
        "HeliaNavigation"
      );
    }

    if (!window.HeliaInventory) {
      missingModules.push(
        "HeliaInventory"
      );
    }

    if (!window.HeliaCamera) {
      missingModules.push(
        "HeliaCamera"
      );
    }

    if (!window.HeliaAI) {
      missingModules.push(
        "HeliaAI"
      );
    }

    if (!window.HeliaExport) {
      missingModules.push(
        "HeliaExport"
      );
    }

    if (missingModules.length > 0) {
      throw new Error(
        `Modules manquants : ${missingModules.join(", ")}. ` +
          "Vérifiez l'ordre des scripts dans index.html."
      );
    }
  }

  /**
   * Applique le thème défini dans config.js.
   */
  function applyTheme() {
    const colors =
      window.HELIA_CONFIG
        ?.theme
        ?.colors;

    if (!colors) {
      console.warn(
        "Aucun thème n'a été trouvé dans HELIA_CONFIG."
      );

      return;
    }

    const root =
      document.documentElement;

    const variables = {
      "--color-primary":
        colors.primary,

      "--color-primary-dark":
        colors.primaryDark,

      "--color-primary-light":
        colors.primaryLight,

      "--color-secondary":
        colors.secondary,

      "--color-secondary-dark":
        colors.secondaryDark,

      "--color-background":
        colors.background,

      "--color-surface":
        colors.surface,

      "--color-surface-muted":
        colors.surfaceMuted,

      "--color-text":
        colors.text,

      "--color-text-muted":
        colors.textMuted,

      "--color-text-on-primary":
        colors.textOnPrimary,

      "--color-success":
        colors.success,

      "--color-warning":
        colors.warning,

      "--color-danger":
        colors.danger,

      "--color-border":
        colors.border,

      "--color-focus":
        colors.focus,
    };

    Object.entries(
      variables
    ).forEach(
      ([name, value]) => {
        if (value) {
          root.style.setProperty(
            name,
            value
          );
        }
      }
    );
  }

  /**
   * Affiche un écran.
   *
   * @param {string} screen Écran demandé.
   */
  function renderScreen(screen) {
    ensureInitialized();

    if (
      screen !==
      window.HELIA_SCREENS.SCAN
    ) {
      stopPredictionLoop();
    }

    appElement.replaceChildren();

    switch (screen) {
      case window.HELIA_SCREENS.HOME:
        renderHomeScreen();
        break;

      case window.HELIA_SCREENS
        .LOCAL_IDENTIFICATION:
        renderLocalIdentificationScreen();
        break;

      case window.HELIA_SCREENS.SCAN:
        renderScanScreen();
        break;

      case window.HELIA_SCREENS.SUMMARY:
        renderSurveySummaryScreen();
        break;

      default:
        renderErrorScreen(
          "L'écran demandé n'existe pas."
        );
    }
  }

  /**
   * Affiche l'accueil.
   */
  function renderHomeScreen() {
    const config =
      window.HELIA_CONFIG;

    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    const hasSurvey =
      survey.localCount > 0;

    const page = createElement(
      "main",
      {
        className:
          "screen screen-home",
      }
    );

    const hero = createElement(
      "section",
      {
        className: "hero-card",

        attributes: {
          "aria-labelledby":
            "application-title",
        },
      }
    );

    const brandMark =
      createElement(
        "div",
        {
          className: "brand-mark",

          textContent:
            config.application
              .suiteName,
        }
      );

    const title = createElement(
      "h1",
      {
        id: "application-title",

        className:
          "application-title",
      }
    );

    const suiteName =
      createElement(
        "span",
        {
          className:
            "application-suite",

          textContent:
            config.application
              .suiteName,
        }
      );

    const moduleName =
      createElement(
        "span",
        {
          className:
            "application-module",

          textContent:
            `${config.application.prefix}-` +
            config.application
              .moduleName,
        }
      );

    title.append(
      suiteName,
      moduleName
    );

    const description =
      createElement(
        "p",
        {
          className:
            "application-description",

          textContent:
            config.application
              .description,
        }
      );

    hero.append(
      brandMark,
      title,
      description
    );

    if (hasSurvey) {
      const surveyBadge =
        createElement(
          "div",
          {
            className: "local-badge",

            textContent:
              survey.displayName,
          }
        );

      const surveyDetails =
        createElement(
          "p",
          {
            className:
              "screen-introduction",

            textContent:
              `${formatLocalCount(
                survey.localCount
              )} · ` +
              formatInventoryTotal(
                survey.totalQuantity
              ),
          }
        );

      const locationDetails =
        createSurveyLocationSummary(
          survey
        );

      const openSurveyButton =
        createButton({
          label:
            "Ouvrir le relevé",

          className:
            "button button-primary button-large",

          onClick: () => {
            summaryFeedbackMessage =
              "";

            surveyInformationFormIsOpen =
              false;

            window.HeliaNavigation
              .navigateTo(
                window.HELIA_SCREENS
                  .SUMMARY
              );
          },
        });

      const addLocalButton =
        createButton({
          label:
            "Ajouter un local",

          className:
            "button button-secondary",

          onClick:
            openCreateLocalScreen,
        });

      hero.append(
        surveyBadge,
        surveyDetails
      );

      if (locationDetails) {
        hero.append(
          locationDetails
        );
      }

      hero.append(
        openSurveyButton,
        addLocalButton
      );

      requestAnimationFrame(
        () => {
          openSurveyButton.focus({
            preventScroll: true,
          });
        }
      );
    } else {
      const startButton =
        createButton({
          label:
            "Commencer un relevé",

          className:
            "button button-primary button-large",

          onClick:
            openCreateLocalScreen,
        });

      hero.append(startButton);

      requestAnimationFrame(
        () => {
          startButton.focus({
            preventScroll: true,
          });
        }
      );
    }

    page.append(hero);

    if (
      config.interface
        .showVersion
    ) {
      const footer =
        createElement(
          "footer",
          {
            className:
              "application-footer",

            textContent:
              `Version ${config.application.version}`,
          }
        );

      page.append(footer);
    }

    appElement.append(page);
  }

  /**
   * Résume le site du relevé sur l'accueil.
   *
   * @param {Object} survey Relevé.
   * @returns {HTMLElement|null}
   */
  function createSurveyLocationSummary(
    survey
  ) {
    const parts = [
      survey.site,
      survey.building,
      survey.level,
      survey.unit,
    ].filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    return createElement(
      "p",
      {
        className: "helper-text",

        textContent:
          parts.join(" · "),
      }
    );
  }

  /**
   * Ouvre l'écran permettant de créer un local.
   */
  function openCreateLocalScreen() {
    summaryFeedbackMessage = "";
    cameraErrorMessage = "";

    window.HeliaNavigation
      .navigateTo(
        window.HELIA_SCREENS
          .LOCAL_IDENTIFICATION
      );
  }

  /**
   * Affiche la création d'un local.
   *
   * Lors du premier local, la fiche du relevé
   * est également affichée.
   */
  function renderLocalIdentificationScreen() {
    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    const isFirstLocal =
      survey.localCount === 0;

    const page = createElement(
      "main",
      {
        className: "screen",
      }
    );

    const header =
      createScreenHeader({
        title: isFirstLocal
          ? "Nouveau relevé"
          : "Ajouter un local",

        onBack: () => {
          stopPredictionLoop();
          window.HeliaCamera.stop();

          window.HeliaNavigation
            .navigateTo(
              isFirstLocal
                ? window.HELIA_SCREENS
                    .HOME
                : window.HELIA_SCREENS
                    .SUMMARY
            );
        },
      });

    const content =
      createElement(
        "section",
        {
          className:
            "content-card",
        }
      );

    const form =
      createElement(
        "form",
        {
          attributes: {
            novalidate: "",
          },
        }
      );

    form.className =
      "field-group";

    if (isFirstLocal) {
      const introduction =
        createElement(
          "p",
          {
            className:
              "screen-introduction",

            textContent:
              "Commencez par identifier le relevé, puis indiquez son premier local.",
          }
        );

      const surveyFields =
        createSurveyInformationFields(
          survey,
          {
            nameIsRequired: true,
          }
        );

      form.append(
        introduction,
        surveyFields
      );
    } else {
      const introduction =
        createElement(
          "p",
          {
            className:
              "screen-introduction",

            textContent:
              `Le nouveau local sera ajouté au relevé « ${survey.displayName} ». ` +
              "Les locaux précédents seront conservés.",
          }
        );

      form.append(introduction);
    }

    const localSection =
      createElement(
        "section",
        {
          className:
            "field-group",
        }
      );

    const localSectionTitle =
      createElement(
        "h2",
        {
          className:
            "summary-title",

          textContent:
            isFirstLocal
              ? "Premier local"
              : "Nouveau local",
        }
      );

    const localField =
      createFormField({
        id: "local-name",

        label:
          "Nom ou identifiant du local",

        type: "text",

        placeholder:
          "Exemple : Cuisine ou A-N01-125",

        required: true,

        attributes: {
          autocomplete: "off",
          enterkeyhint: "done",
          autocapitalize:
            "sentences",
        },
      });

    const qrButton =
      createButton({
        label:
          "Scanner un QR code",

        className:
          "button button-secondary",

        disabled: true,
      });

    const qrNotice =
      createElement(
        "p",
        {
          className:
            "helper-text",

          textContent:
            "Le lecteur QR code sera ajouté dans une prochaine étape.",
        }
      );

    localSection.append(
      localSectionTitle,
      localField.container,
      qrButton,
      qrNotice
    );

    const continueButton =
      createButton({
        label: isFirstLocal
          ? "Créer le relevé et continuer"
          : "Créer le local et continuer",

        className:
          "button button-primary button-large",

        attributes: {
          type: "submit",
        },
      });

    form.append(
      localSection,
      continueButton
    );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        createLocalAndContinue({
          isFirstLocal,
          localInput:
            localField.input,
        });
      }
    );

    content.append(form);

    page.append(
      header,
      content
    );

    appElement.append(page);

    requestAnimationFrame(
      () => {
        const firstField =
          isFirstLocal
            ? document.getElementById(
                "survey-name"
              )
            : localField.input;

        firstField?.focus({
          preventScroll: true,
        });
      }
    );
  }

  /**
   * Crée les champs de la fiche du relevé.
   *
   * @param {Object} survey Relevé.
   * @param {Object} options Options.
   * @returns {HTMLElement}
   */
  function createSurveyInformationFields(
    survey,
    {
      nameIsRequired = true,
    } = {}
  ) {
    const section =
      createElement(
        "section",
        {
          className:
            "field-group",

          attributes: {
            "aria-labelledby":
              "survey-information-title",
          },
        }
      );

    const title =
      createElement(
        "h2",
        {
          id:
            "survey-information-title",

          className:
            "summary-title",

          textContent:
            "Informations du relevé",
        }
      );

    const explanation =
      createElement(
        "p",
        {
          className:
            "screen-introduction",

          textContent:
            "Ces informations identifieront la visite et seront reprises dans les futurs exports.",
        }
      );

    const nameField =
      createFormField({
        id: "survey-name",

        label:
          "Nom du relevé",

        type: "text",

        value:
          survey.name,

        placeholder:
          "Exemple : Inventaire maison test",

        required:
          nameIsRequired,

        attributes: {
          autocomplete: "off",
        },
      });

    const referenceField =
      createFormField({
        id: "survey-reference",

        label:
          "Référence du dossier",

        type: "text",

        value:
          survey.reference,

        placeholder:
          "Exemple : HELIA-2026-001",

        attributes: {
          autocomplete: "off",
        },
      });

    const siteField =
      createFormField({
        id: "survey-site",

        label: "Site",

        type: "text",

        value:
          survey.site,

        placeholder:
          "Exemple : Site de Jolimont",
      });

    const buildingField =
      createFormField({
        id:
          "survey-building",

        label: "Bâtiment",

        type: "text",

        value:
          survey.building,

        placeholder:
          "Exemple : Bloc A",
      });

    const levelField =
      createFormField({
        id: "survey-level",

        label:
          "Étage ou niveau",

        type: "text",

        value:
          survey.level,

        placeholder:
          "Exemple : Niveau 1",
      });

    const unitField =
      createFormField({
        id: "survey-unit",

        label:
          "Unité ou service",

        type: "text",

        value:
          survey.unit,

        placeholder:
          "Exemple : Imagerie médicale",
      });

    const operatorField =
      createFormField({
        id:
          "survey-operator",

        label:
          "Opérateur du relevé",

        type: "text",

        value:
          survey.operatorName,

        placeholder:
          "Nom de la personne réalisant le relevé",

        attributes: {
          autocomplete: "name",
        },
      });

    const dateField =
      createFormField({
        id: "survey-date",

        label:
          "Date du relevé",

        type: "date",

        value:
          survey.surveyDate,
      });

    const notesField =
      createFormField({
        id: "survey-notes",

        label: "Notes",

        type: "textarea",

        value:
          survey.notes,

        placeholder:
          "Informations complémentaires, périmètre ou remarques…",

        attributes: {
          rows: "5",
        },
      });

    section.append(
      title,
      explanation,
      nameField.container,
      referenceField.container,
      siteField.container,
      buildingField.container,
      levelField.container,
      unitField.container,
      operatorField.container,
      dateField.container,
      notesField.container
    );

    return section;
  }

  /**
   * Crée un champ de formulaire.
   *
   * @param {Object} options Paramètres du champ.
   * @returns {{container: HTMLElement, input: HTMLElement}}
   */
  function createFormField({
    id,
    label,
    type = "text",
    value = "",
    placeholder = "",
    required = false,
    attributes = {},
  }) {
    const container =
      createElement(
        "div",
        {
          className:
            "field-group",
        }
      );

    const labelElement =
      createElement(
        "label",
        {
          className:
            "field-label",

          textContent:
            required
              ? `${label} *`
              : label,

          attributes: {
            for: id,
          },
        }
      );

    let input = null;

    if (type === "textarea") {
      input =
        createElement(
          "textarea",
          {
            id,

            className:
              "text-input",

            attributes: {
              placeholder,
              ...attributes,
            },
          }
        );

      input.value =
        value ?? "";
    } else {
      input =
        createElement(
          "input",
          {
            id,

            className:
              "text-input",

            attributes: {
              type,
              placeholder,
              ...attributes,
            },
          }
        );

      input.value =
        value ?? "";
    }

    if (required) {
      input.required = true;

      input.setAttribute(
        "aria-required",
        "true"
      );
    }

    container.append(
      labelElement,
      input
    );

    return {
      container,
      input,
    };
  }

  /**
   * Crée le relevé ou ajoute un nouveau local.
   *
   * @param {Object} options Paramètres.
   */
  function createLocalAndContinue({
    isFirstLocal,
    localInput,
  }) {
    clearAllVisibleFieldErrors();

    try {
      /*
       * Lors du premier local, les informations du relevé
       * sont validées avant le nom du local.
       *
       * Les erreurs de saisie sont affichées sous leur champ
       * et ne sont pas envoyées à console.error().
       */
      const surveyInformation =
        isFirstLocal
          ? collectSurveyInformation({
              requireName: true,
            })
          : null;

      const localName =
        localInput.value.trim();

      if (!localName) {
        displayFieldError(
          localInput,
          "Veuillez saisir un identifiant de local."
        );

        localInput.focus();
        return;
      }

      if (surveyInformation) {
        window.HeliaInventory
          .setSurveyInformation(
            surveyInformation
          );
      }

      window.HeliaInventory
        .createLocal(
          localName
        );

      cameraErrorMessage = "";
      summaryFeedbackMessage = "";

      surveyInformationFormIsOpen =
        false;

      window.HeliaNavigation
        .navigateTo(
          window.HELIA_SCREENS
            .SCAN
        );
    } catch (error) {
      /*
       * Ces erreurs sont de simples erreurs de formulaire.
       * Leur message est déjà affiché sous le champ concerné.
       */
      if (
        error?.code ===
        "MISSING_SURVEY_NAME"
      ) {
        return;
      }

      if (
        error?.code ===
        "INVALID_SURVEY_DATE"
      ) {
        const dateInput =
          document.getElementById(
            "survey-date"
          );

        if (
          dateInput &&
          dateInput.getAttribute(
            "aria-invalid"
          ) !== "true"
        ) {
          displayFieldError(
            dateInput,
            error.message ||
              "La date du relevé est invalide."
          );

          dateInput.focus();
        }

        return;
      }

      /*
       * Seules les véritables erreurs techniques
       * sont envoyées dans la console.
       */
      console.error(
        "Erreur technique lors de la création du local :",
        error
      );

      displayFieldError(
        localInput,
        error.message ||
          "Impossible de créer le local."
      );

      localInput.focus();
    }
  }

  /**
   * Lit les informations du relevé dans le formulaire.
   *
   * @param {Object} options Options.
   * @returns {Object}
   */
  function collectSurveyInformation({
    requireName = false,
  } = {}) {
    const nameInput =
      document.getElementById(
        "survey-name"
      );

    const information = {
      name:
        getElementValue(
          "survey-name"
        ),

      reference:
        getElementValue(
          "survey-reference"
        ),

      site:
        getElementValue(
          "survey-site"
        ),

      building:
        getElementValue(
          "survey-building"
        ),

      level:
        getElementValue(
          "survey-level"
        ),

      unit:
        getElementValue(
          "survey-unit"
        ),

      operatorName:
        getElementValue(
          "survey-operator"
        ),

      surveyDate:
        getElementValue(
          "survey-date"
        ),

      notes:
        getElementValue(
          "survey-notes",
          false
        ),
    };

    if (
      requireName &&
      !information.name
    ) {
      if (nameInput) {
        displayFieldError(
          nameInput,
          "Veuillez donner un nom au relevé."
        );

        nameInput.focus();
      }

      throw createUIError(
        "MISSING_SURVEY_NAME",
        "Le nom du relevé est obligatoire."
      );
    }

    const dateInput =
      document.getElementById(
        "survey-date"
      );

    if (
      dateInput?.value &&
      !dateInput.checkValidity()
    ) {
      displayFieldError(
        dateInput,
        "La date du relevé est invalide."
      );

      dateInput.focus();

      throw createUIError(
        "INVALID_SURVEY_DATE",
        "La date du relevé est invalide."
      );
    }

    return information;
  }

  /**
   * Lit la valeur d'un champ.
   *
   * @param {string} elementId Identifiant.
   * @param {boolean} collapseSpaces Réduire les espaces.
   * @returns {string}
   */
  function getElementValue(
    elementId,
    collapseSpaces = true
  ) {
    const element =
      document.getElementById(
        elementId
      );

    if (!element) {
      return "";
    }

    const value =
      String(
        element.value ?? ""
      );

    if (!collapseSpaces) {
      return value.trim();
    }

    return value
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Affiche l'écran de scan du local actif.
   */
  function renderScanScreen() {
    const session =
      window.HeliaInventory
        .getSessionSnapshot();

    if (!session.localIdentifier) {
      openCreateLocalScreen();
      return;
    }

    const cameraState =
      window.HeliaCamera
        .getSnapshot();

    const inventoryIsScanning =
      session.status ===
      window.HeliaInventory
        .SCAN_STATUS
        .SCANNING;

    const scanIsActive =
      inventoryIsScanning &&
      cameraState.isActive;

    const page = createElement(
      "main",
      {
        className: "screen",
      }
    );

    const header =
      createScreenHeader({
        title:
          "Scanner le local",

        onBack: () => {
          handleBackFromScan(
            scanIsActive
          );
        },
      });

    const content =
      createElement(
        "section",
        {
          className:
            "content-card scan-content",
        }
      );

    const statusRow =
      createElement(
        "div",
        {
          className:
            "scan-status-row",
        }
      );

    const localBadge =
      createElement(
        "div",
        {
          className:
            "local-badge",

          textContent:
            `LOCAL · ${session.localIdentifier}`,
        }
      );

    const statusBadge =
      createElement(
        "div",
        {
          className:
            scanIsActive
              ? "status-pill status-pill-active"
              : "status-pill status-pill-ready",

          textContent:
            scanIsActive
              ? "Scan en cours"
              : "Caméra arrêtée",

          attributes: {
            role: "status",
          },
        }
      );

    statusRow.append(
      localBadge,
      statusBadge
    );

    const description =
      createElement(
        "p",
        {
          className:
            "screen-introduction",

          textContent:
            scanIsActive
              ? "Placez un seul objet dans le cadre central."
              : "Démarrez ou reprenez le scan pour activer la caméra.",
        }
      );

    const cameraViewport =
      createCameraViewport(
        scanIsActive
      );

    const predictionPanel =
      createPredictionPanel(
        scanIsActive
      );

    const counter =
      createElement(
        "div",
        {
          id:
            "scan-object-counter",

          className:
            "scan-counter",

          textContent:
            formatInventoryTotal(
              session.totalQuantity
            ),

          attributes: {
            "aria-live":
              "polite",
          },
        }
      );

    content.append(
      statusRow,
      description,
      cameraViewport,
      predictionPanel,
      counter
    );

    if (cameraErrorMessage) {
      const cameraError =
        createElement(
          "div",
          {
            className:
              "inline-alert",

            textContent:
              cameraErrorMessage,

            attributes: {
              role: "alert",
            },
          }
        );

      content.append(
        cameraError
      );
    }

    const primaryAction =
      scanIsActive
        ? createButton({
            label:
              "Terminer ce local",

            className:
              "button button-primary button-large",

            onClick:
              completeScan,
          })
        : createButton({
            label:
              session.totalQuantity > 0
                ? "Reprendre le scan"
                : "Démarrer le scan",

            className:
              "button button-primary button-large",

            onClick: (event) => {
              void activateCameraAndStartScan(
                event.currentTarget
              );
            },
          });

    const surveyButton =
      createButton({
        label:
          "Voir tous les locaux",

        className:
          "button button-secondary",

        onClick:
          returnToSurveySummary,
      });

    content.append(
      primaryAction,
      surveyButton
    );

    page.append(
      header,
      content
    );

    appElement.append(page);

    requestAnimationFrame(
      () => {
        primaryAction.focus({
          preventScroll: true,
        });
      }
    );
  }

  /**
   * Retourne au récapitulatif général.
   */
  function returnToSurveySummary() {
    stopPredictionLoop();
    window.HeliaCamera.stop();

    if (
      window.HeliaInventory
        .isScanActive()
    ) {
      window.HeliaInventory
        .stopScan();
    }

    resetScanInteractionState();

    cameraErrorMessage = "";

    window.HeliaNavigation
      .navigateTo(
        window.HELIA_SCREENS
          .SUMMARY
      );
  }

  /**
   * Crée l'aperçu de la caméra.
   *
   * @param {boolean} scanIsActive État du scan.
   * @returns {HTMLElement}
   */
  function createCameraViewport(
    scanIsActive
  ) {
    const viewport =
      createElement(
        "section",
        {
          className:
            "camera-viewport",

          attributes: {
            "aria-label":
              "Prévisualisation de la caméra",
          },
        }
      );

    if (!scanIsActive) {
      const placeholder =
        createElement(
          "div",
          {
            className:
              "camera-placeholder",
          }
        );

      const symbol =
        createElement(
          "div",
          {
            className:
              "camera-placeholder-symbol",

            textContent: "+",

            attributes: {
              "aria-hidden":
                "true",
            },
          }
        );

      const title =
        createElement(
          "strong",
          {
            textContent:
              "Caméra inactive",
          }
        );

      const message =
        createElement(
          "p",
          {
            textContent:
              "Appuyez sur le bouton de démarrage pour afficher l'image.",
          }
        );

      placeholder.append(
        symbol,
        title,
        message
      );

      viewport.append(
        placeholder
      );

      return viewport;
    }

    const videoElement =
      createElement(
        "video",
        {
          id:
            "helia-camera-preview",

          className:
            "camera-preview",

          attributes: {
            autoplay: "",
            muted: "",
            playsinline: "",

            "aria-label":
              "Image en direct de la caméra",
          },
        }
      );

    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;

    const guide =
      createElement(
        "div",
        {
          className:
            "camera-guide",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    const guideLabel =
      createElement(
        "div",
        {
          className:
            "camera-guide-label",

          textContent:
            "Placez un objet dans le cadre",
        }
      );

    viewport.append(
      videoElement,
      guide,
      guideLabel
    );

    requestAnimationFrame(
      async () => {
        try {
          await window.HeliaCamera
            .attachTo(
              videoElement
            );

          if (
            !scanPausedForConfirmation
          ) {
            startPredictionLoop(
              videoElement
            );
          }
        } catch (error) {
          console.error(
            "Impossible d'afficher le flux vidéo :",
            error
          );

          cameraErrorMessage =
            error.message ||
            "Impossible d'afficher le flux de la caméra.";

          stopPredictionLoop();
          window.HeliaCamera.stop();

          if (
            window.HeliaInventory
              .isScanActive()
          ) {
            window.HeliaInventory
              .stopScan();
          }

          renderScreen(
            window.HELIA_SCREENS
              .SCAN
          );
        }
      }
    );

    return viewport;
  }

  /**
   * Crée le panneau IA.
   *
   * @param {boolean} scanIsActive État du scan.
   * @returns {HTMLElement}
   */
  function createPredictionPanel(
    scanIsActive
  ) {
    const panel =
      createElement(
        "section",
        {
          id:
            "ai-prediction-panel",

          className:
            "prediction-card",

          attributes: {
            "aria-labelledby":
              "ai-prediction-title",

            "aria-live":
              "polite",
          },
        }
      );

    const header =
      createElement(
        "div",
        {
          className:
            "prediction-header",
        }
      );

    const title =
      createElement(
        "h2",
        {
          id:
            "ai-prediction-title",

          className:
            "prediction-title",

          textContent:
            "Reconnaissance IA",
        }
      );

    const status =
      createElement(
        "span",
        {
          id:
            "ai-engine-status",

          className:
            scanIsActive
              ? "status-pill status-pill-active"
              : "status-pill status-pill-ready",

          textContent:
            scanIsActive
              ? "Analyse"
              : "En attente",
        }
      );

    header.append(
      title,
      status
    );

    const mainResult =
      createElement(
        "div",
        {
          id:
            "ai-main-result",

          className:
            "prediction-main-result",
        }
      );

    const mainLabel =
      createElement(
        "strong",
        {
          id:
            "ai-main-label",

          textContent:
            scanIsActive
              ? "Préparation de l'analyse…"
              : "L'analyse démarrera avec la caméra.",
        }
      );

    const mainDetails =
      createElement(
        "p",
        {
          id:
            "ai-main-details",

          textContent:
            scanIsActive
              ? "Le modèle recherche un résultat stable."
              : "Aucun résultat pour le moment.",
        }
      );

    mainResult.append(
      mainLabel,
      mainDetails
    );

    const list =
      createElement(
        "div",
        {
          id:
            "ai-prediction-list",

          className:
            "prediction-list",
        }
      );

    const actions =
      createElement(
        "div",
        {
          id:
            "ai-prediction-actions",

          className:
            "prediction-actions",
        }
      );

    panel.append(
      header,
      mainResult,
      list,
      actions
    );

    return panel;
  }

  /**
   * Démarre la boucle d'analyse.
   *
   * @param {HTMLVideoElement} videoElement Vidéo.
   */
  function startPredictionLoop(
    videoElement
  ) {
    stopPredictionLoop();

    scanPausedForConfirmation =
      false;

    const currentGeneration =
      predictionLoopGeneration;

    updatePredictionStatus(
      "Analyse",
      "Préparation de l'analyse…",
      "Le modèle attend une image exploitable."
    );

    clearPredictionActions();

    const runCycle =
      async () => {
        if (
          currentGeneration !==
          predictionLoopGeneration
        ) {
          return;
        }

        if (
          scanPausedForConfirmation ||
          !document.body.contains(
            videoElement
          ) ||
          !window.HeliaCamera
            .hasActiveStream() ||
          !window.HeliaInventory
            .isScanActive()
        ) {
          return;
        }

        if (
          predictionInProgress
        ) {
          scheduleNextPrediction(
            runCycle,
            currentGeneration
          );

          return;
        }

        predictionInProgress =
          true;

        try {
          const result =
            await window.HeliaAI
              .analyzeVideo(
                videoElement
              );

          if (
            currentGeneration !==
            predictionLoopGeneration
          ) {
            return;
          }

          updatePredictionPanel(
            result
          );
        } catch (error) {
          const videoIsPreparing =
            [
              "VIDEO_NOT_READY",
              "VIDEO_DIMENSIONS_NOT_READY",
              "INVALID_VIDEO_DIMENSIONS",
            ].includes(
              error?.code
            );

          if (videoIsPreparing) {
            updatePredictionStatus(
              "Préparation",
              "Initialisation de la caméra…",
              "La première image sera bientôt analysée."
            );
          } else {
            console.error(
              "Erreur durant la reconnaissance :",
              error
            );

            updatePredictionStatus(
              "Erreur",
              "Analyse momentanément indisponible",
              error.message ||
                "L'intelligence artificielle n'a pas pu analyser l'image."
            );
          }
        } finally {
          predictionInProgress =
            false;

          if (
            !scanPausedForConfirmation
          ) {
            scheduleNextPrediction(
              runCycle,
              currentGeneration
            );
          }
        }
      };

    void runCycle();
  }

  /**
   * Programme l'analyse suivante.
   *
   * @param {Function} callback Fonction.
   * @param {number} generation Génération.
   */
  function scheduleNextPrediction(
    callback,
    generation
  ) {
    if (
      generation !==
        predictionLoopGeneration ||
      scanPausedForConfirmation
    ) {
      return;
    }

    clearPredictionTimer();

    predictionTimerId =
      window.setTimeout(
        callback,
        getPredictionInterval()
      );
  }

  /**
   * Arrête la boucle IA.
   */
  function stopPredictionLoop() {
    predictionLoopGeneration += 1;
    predictionInProgress = false;

    clearPredictionTimer();
  }

  /**
   * Supprime le minuteur IA.
   */
  function clearPredictionTimer() {
    if (
      predictionTimerId !== null
    ) {
      window.clearTimeout(
        predictionTimerId
      );

      predictionTimerId = null;
    }
  }

  /**
   * Retourne l'intervalle de prédiction.
   *
   * @returns {number}
   */
  function getPredictionInterval() {
    const configuredInterval =
      Number(
        window.HELIA_CONFIG
          ?.artificialIntelligence
          ?.predictionIntervalMs
      );

    if (
      Number.isFinite(
        configuredInterval
      ) &&
      configuredInterval >= 100
    ) {
      return configuredInterval;
    }

    return 450;
  }

  /**
   * Met à jour le panneau IA.
   *
   * @param {Object} result Résultat.
   */
  function updatePredictionPanel(
    result
  ) {
    latestAnalysisResult =
      result;

    renderPredictionList(
      result?.displayedPredictions ??
        []
    );

    const stableCandidate =
      result?.stableCandidate ??
      null;

    const bestCandidate =
      result?.bestCandidate ??
      null;

    const stability =
      result?.stability ?? null;

    if (stableCandidate) {
      freezeSelectedPrediction(
        stableCandidate,
        "stable"
      );

      return;
    }

    clearPredictionActions();
    selectedPrediction = null;

    if (bestCandidate) {
      updatePredictionStatus(
        "Analyse",

        `Objet probable : ${bestCandidate.className}`,

        `Confiance : ${formatPercentage(
          bestCandidate.percentage
        )} · Stabilisation ${
          stability?.consecutiveCount ??
          0
        }/${
          stability?.requiredCount ??
          1
        }`
      );

      return;
    }

    const minimumConfidence =
      Number(
        window.HELIA_CONFIG
          ?.artificialIntelligence
          ?.minimumConfidence
      ) || 0.6;

    updatePredictionStatus(
      "Recherche",
      "Aucun résultat suffisamment fiable",

      `Placez l'objet au centre du cadre. ` +
        `Seuil actuel : ${Math.round(
          minimumConfidence * 100
        )} %.`
    );
  }

  /**
   * Fige une proposition.
   *
   * @param {Object} prediction Proposition.
   * @param {string} selectionMode Mode.
   */
  function freezeSelectedPrediction(
    prediction,
    selectionMode
  ) {
    if (!prediction) {
      return;
    }

    selectedPrediction = {
      ...prediction,
      selectionMode,
    };

    scanPausedForConfirmation =
      true;

    quantityModeIsOpen = false;
    selectedQuantity = 1;

    stopPredictionLoop();

    updatePredictionStatus(
      "À confirmer",

      `Objet sélectionné : ${prediction.className}`,

      `Confiance : ${formatPercentage(
        prediction.percentage
      )}`
    );

    renderPredictionList(
      latestAnalysisResult
        ?.displayedPredictions ??
        [],

      prediction.className
    );

    renderPredictionActions();
  }

  /**
   * Affiche les prédictions.
   *
   * @param {Array<Object>} predictions Liste.
   * @param {string|null} selectedClass Classe sélectionnée.
   */
  function renderPredictionList(
    predictions,
    selectedClass = null
  ) {
    const listElement =
      document.getElementById(
        "ai-prediction-list"
      );

    if (!listElement) {
      return;
    }

    listElement.replaceChildren();

    if (
      !Array.isArray(
        predictions
      )
    ) {
      return;
    }

    predictions.forEach(
      (prediction) => {
        const isSelectable =
          !prediction.isIgnored &&
          prediction
            .meetsMinimumConfidence;

        const isSelected =
          selectedClass ===
          prediction.className;

        const row =
          createElement(
            "button",
            {
              className: [
                "prediction-row",

                prediction.isIgnored
                  ? "prediction-row-ignored"
                  : "",

                isSelectable
                  ? "prediction-row-selectable"
                  : "",

                isSelected
                  ? "prediction-row-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" "),

              attributes: {
                type: "button",

                "aria-label":
                  `${prediction.className}, ` +
                  formatPercentage(
                    prediction.percentage
                  ),
              },
            }
          );

        row.disabled =
          !isSelectable;

        if (isSelectable) {
          row.addEventListener(
            "click",
            () => {
              freezeSelectedPrediction(
                prediction,
                "manual"
              );
            }
          );
        }

        const rowHeader =
          createElement(
            "div",
            {
              className:
                "prediction-row-header",
            }
          );

        const label =
          createElement(
            "span",
            {
              className:
                "prediction-class-name",

              textContent:
                prediction.isIgnored
                  ? `${prediction.className} · ignorée`
                  : prediction.className,
            }
          );

        const percentage =
          createElement(
            "strong",
            {
              className:
                "prediction-percentage",

              textContent:
                formatPercentage(
                  prediction.percentage
                ),
            }
          );

        rowHeader.append(
          label,
          percentage
        );

        const progressTrack =
          createElement(
            "div",
            {
              className:
                "prediction-progress-track",

              attributes: {
                role:
                  "progressbar",

                "aria-valuemin":
                  "0",

                "aria-valuemax":
                  "100",

                "aria-valuenow":
                  String(
                    Math.round(
                      prediction.percentage
                    )
                  ),
              },
            }
          );

        const progressBar =
          createElement(
            "div",
            {
              className:
                "prediction-progress-bar",
            }
          );

        progressBar.style.width =
          `${Math.min(
            Math.max(
              prediction.percentage,
              0
            ),
            100
          )}%`;

        progressTrack.append(
          progressBar
        );

        row.append(
          rowHeader,
          progressTrack
        );

        listElement.append(row);
      }
    );
  }

  /**
   * Affiche les actions de validation.
   */
  function renderPredictionActions() {
    const actionsElement =
      document.getElementById(
        "ai-prediction-actions"
      );

    if (
      !actionsElement ||
      !selectedPrediction
    ) {
      return;
    }

    actionsElement.replaceChildren();

    if (quantityModeIsOpen) {
      renderQuantityEditor(
        actionsElement
      );

      return;
    }

    const validateButton =
      createButton({
        label: "Valider 1",

        className:
          "button button-primary",

        onClick: () => {
          addSelectedObject(1);
        },
      });

    const quantityButton =
      createButton({
        label:
          "Indiquer une quantité",

        className:
          "button button-secondary",

        onClick: () => {
          quantityModeIsOpen =
            true;

          selectedQuantity = 1;

          renderPredictionActions();
        },
      });

    const ignoreButton =
      createButton({
        label: "Ignorer",

        className:
          "button button-secondary",

        onClick:
          ignoreSelectedPrediction,
      });

    actionsElement.append(
      validateButton,
      quantityButton,
      ignoreButton
    );
  }

  /**
   * Affiche l'éditeur de quantité.
   *
   * @param {HTMLElement} actionsElement Conteneur.
   */
  function renderQuantityEditor(
    actionsElement
  ) {
    actionsElement.replaceChildren();

    const title =
      createElement(
        "strong",
        {
          className:
            "quantity-title",

          textContent:
            `Combien de « ${selectedPrediction.className} » ?`,
        }
      );

    const controls =
      createElement(
        "div",
        {
          className:
            "quantity-controls",
        }
      );

    const minusButton =
      createButton({
        label: "−",

        className:
          "button quantity-button",

        attributes: {
          "aria-label":
            "Diminuer la quantité",
        },

        onClick: () => {
          selectedQuantity =
            Math.max(
              1,
              selectedQuantity - 1
            );

          renderPredictionActions();
        },
      });

    const quantityInput =
      createElement(
        "input",
        {
          id:
            "selected-object-quantity",

          className:
            "text-input quantity-input",

          attributes: {
            type: "number",
            min: "1",
            max: "999",
            inputmode: "numeric",

            "aria-label":
              "Quantité à enregistrer",
          },
        }
      );

    quantityInput.value =
      String(selectedQuantity);

    quantityInput.addEventListener(
      "change",
      () => {
        selectedQuantity =
          normalizeQuantity(
            quantityInput.value
          );

        quantityInput.value =
          String(
            selectedQuantity
          );
      }
    );

    const plusButton =
      createButton({
        label: "+",

        className:
          "button quantity-button",

        attributes: {
          "aria-label":
            "Augmenter la quantité",
        },

        onClick: () => {
          selectedQuantity =
            Math.min(
              999,
              selectedQuantity + 1
            );

          renderPredictionActions();
        },
      });

    controls.append(
      minusButton,
      quantityInput,
      plusButton
    );

    const confirmButton =
      createButton({
        label:
          "Ajouter la quantité sélectionnée",

        className:
          "button button-primary",

        onClick: () => {
          const currentInput =
            document.getElementById(
              "selected-object-quantity"
            );

          addSelectedObject(
            normalizeQuantity(
              currentInput?.value ??
                selectedQuantity
            )
          );
        },
      });

    const cancelButton =
      createButton({
        label: "Annuler",

        className:
          "button button-secondary",

        onClick: () => {
          quantityModeIsOpen =
            false;

          selectedQuantity = 1;

          renderPredictionActions();
        },
      });

    actionsElement.append(
      title,
      controls,
      confirmButton,
      cancelButton
    );

    requestAnimationFrame(
      () => {
        quantityInput.focus({
          preventScroll: true,
        });

        quantityInput.select();
      }
    );
  }

  /**
   * Ajoute l'objet sélectionné.
   *
   * @param {number} quantity Quantité.
   */
  function addSelectedObject(
    quantity
  ) {
    if (!selectedPrediction) {
      return;
    }

    try {
      const normalizedQuantity =
        normalizeQuantity(
          quantity
        );

      const addedItem =
        window.HeliaInventory
          .addItem({
            label:
              selectedPrediction
                .className,

            quantity:
              normalizedQuantity,

            confidence:
              selectedPrediction
                .probability,

            source:
              "teachable-machine",
          });

      lastAddedItemId =
        addedItem.id;

      window.HeliaAI
        .resetStability();

      quantityModeIsOpen =
        false;

      updateInventoryCounter();

      updatePredictionStatus(
        "Ajouté",

        formatAddedObjectMessage(
          selectedPrediction
            .className,

          normalizedQuantity
        ),

        "Déplacez la caméra vers l'objet suivant, puis reprenez l'analyse."
      );

      clearPredictionList();
      renderPostValidationActions();
    } catch (error) {
      console.error(
        "Impossible d'ajouter l'objet :",
        error
      );

      updatePredictionStatus(
        "Erreur",
        "L'objet n'a pas été ajouté",

        error.message ||
          "Une erreur inattendue est survenue."
      );
    }
  }

  /**
   * Affiche les actions après validation.
   */
  function renderPostValidationActions() {
    const actionsElement =
      document.getElementById(
        "ai-prediction-actions"
      );

    if (!actionsElement) {
      return;
    }

    actionsElement.replaceChildren();

    const nextButton =
      createButton({
        label:
          "Scanner l'objet suivant",

        className:
          "button button-primary button-large",

        onClick:
          resumePredictionForNextObject,
      });

    const undoButton =
      createButton({
        label:
          "Annuler le dernier ajout",

        className:
          "button button-secondary",

        disabled:
          !lastAddedItemId,

        onClick:
          undoLastAddedItem,
      });

    actionsElement.append(
      nextButton,
      undoButton
    );
  }

  /**
   * Annule le dernier ajout.
   */
  function undoLastAddedItem() {
    if (!lastAddedItemId) {
      return;
    }

    const removed =
      window.HeliaInventory
        .removeItem(
          lastAddedItemId
        );

    if (!removed) {
      return;
    }

    lastAddedItemId = null;

    updateInventoryCounter();

    updatePredictionStatus(
      "Annulé",
      "Le dernier ajout a été supprimé",
      "Vous pouvez reprendre l'analyse."
    );

    renderResumeAnalysisButton(
      "Reprendre l'analyse"
    );
  }

  /**
   * Ignore la proposition.
   */
  function ignoreSelectedPrediction() {
    window.HeliaAI
      .resetStability();

    selectedPrediction = null;
    quantityModeIsOpen = false;
    lastAddedItemId = null;

    updatePredictionStatus(
      "Ignoré",
      "La proposition a été ignorée",

      "Déplacez légèrement la caméra avant de reprendre l'analyse."
    );

    clearPredictionList();

    renderResumeAnalysisButton(
      "Reprendre l'analyse"
    );
  }

  /**
   * Affiche un bouton de reprise.
   *
   * @param {string} label Libellé.
   */
  function renderResumeAnalysisButton(
    label
  ) {
    const actionsElement =
      document.getElementById(
        "ai-prediction-actions"
      );

    if (!actionsElement) {
      return;
    }

    actionsElement.replaceChildren();

    actionsElement.append(
      createButton({
        label,

        className:
          "button button-primary button-large",

        onClick:
          resumePredictionForNextObject,
      })
    );
  }

  /**
   * Reprend l'analyse.
   */
  function resumePredictionForNextObject() {
    const videoElement =
      document.getElementById(
        "helia-camera-preview"
      );

    if (
      !videoElement ||
      !window.HeliaCamera
        .hasActiveStream()
    ) {
      cameraErrorMessage =
        "Le flux de la caméra n'est plus disponible.";

      renderScreen(
        window.HELIA_SCREENS
          .SCAN
      );

      return;
    }

    selectedPrediction = null;
    latestAnalysisResult = null;

    scanPausedForConfirmation =
      false;

    quantityModeIsOpen = false;
    selectedQuantity = 1;
    lastAddedItemId = null;

    clearPredictionList();
    clearPredictionActions();

    window.HeliaAI
      .resetStability();

    startPredictionLoop(
      videoElement
    );
  }

  /**
   * Efface la liste des prédictions.
   */
  function clearPredictionList() {
    document
      .getElementById(
        "ai-prediction-list"
      )
      ?.replaceChildren();
  }

  /**
   * Efface les actions de prédiction.
   */
  function clearPredictionActions() {
    document
      .getElementById(
        "ai-prediction-actions"
      )
      ?.replaceChildren();
  }

  /**
   * Met à jour le compteur du local.
   */
  function updateInventoryCounter() {
    const counterElement =
      document.getElementById(
        "scan-object-counter"
      );

    if (!counterElement) {
      return;
    }

    const session =
      window.HeliaInventory
        .getSessionSnapshot();

    counterElement.textContent =
      formatInventoryTotal(
        session.totalQuantity
      );
  }

  /**
   * Met à jour le statut IA.
   *
   * @param {string} status Statut.
   * @param {string} label Résultat.
   * @param {string} details Détails.
   */
  function updatePredictionStatus(
    status,
    label,
    details
  ) {
    const statusElement =
      document.getElementById(
        "ai-engine-status"
      );

    const labelElement =
      document.getElementById(
        "ai-main-label"
      );

    const detailsElement =
      document.getElementById(
        "ai-main-details"
      );

    if (statusElement) {
      statusElement.textContent =
        status;
    }

    if (labelElement) {
      labelElement.textContent =
        label;
    }

    if (detailsElement) {
      detailsElement.textContent =
        details;
    }
  }

  /**
   * Active la caméra.
   *
   * @param {HTMLButtonElement} button Bouton.
   */
  async function activateCameraAndStartScan(
    button
  ) {
    cameraErrorMessage = "";
    summaryFeedbackMessage = "";

    resetScanInteractionState();

    setButtonLoading(
      button,
      "Activation de la caméra…"
    );

    try {
      await Promise.all([
        window.HeliaCamera.start(),
        window.HeliaAI.initialize(),
      ]);

      window.HeliaInventory
        .startScan();

      window.HeliaNavigation
        .navigateTo(
          window.HELIA_SCREENS
            .SCAN
        );
    } catch (error) {
      console.error(
        "Erreur lors de l'activation du scan :",
        error
      );

      cameraErrorMessage =
        error.message ||
        "Impossible d'activer la caméra ou l'intelligence artificielle.";

      stopPredictionLoop();
      window.HeliaCamera.stop();

      window.HeliaNavigation
        .navigateTo(
          window.HELIA_SCREENS
            .SCAN
        );
    }
  }

  /**
   * Sélectionne et reprend un local.
   *
   * @param {string} localId Identifiant.
   * @param {HTMLButtonElement} button Bouton.
   */
  async function resumeLocalScan(
    localId,
    button
  ) {
    try {
      window.HeliaInventory
        .selectLocal(
          localId
        );

      await activateCameraAndStartScan(
        button
      );
    } catch (error) {
      console.error(
        "Impossible de reprendre le local :",
        error
      );

      summaryFeedbackMessage =
        error.message ||
        "Le local n'a pas pu être rouvert.";

      renderScreen(
        window.HELIA_SCREENS
          .SUMMARY
      );
    }
  }

  /**
   * Termine le local actif.
   */
  function completeScan() {
    stopPredictionLoop();
    window.HeliaCamera.stop();

    const scanStopped =
      window.HeliaInventory
        .stopScan();

    if (!scanStopped) {
      cameraErrorMessage =
        "Le scan n'était pas actif et n'a pas pu être terminé.";

      renderScreen(
        window.HELIA_SCREENS
          .SCAN
      );

      return;
    }

    resetScanInteractionState();

    cameraErrorMessage = "";

    summaryFeedbackMessage =
      "Le local a été enregistré dans le relevé.";

    window.HeliaNavigation
      .navigateTo(
        window.HELIA_SCREENS
          .SUMMARY
      );
  }

  /**
   * Gère le retour depuis le scan.
   *
   * @param {boolean} scanIsActive État.
   */
  function handleBackFromScan(
    scanIsActive
  ) {
    if (scanIsActive) {
      const confirmed =
        window.confirm(
          "Le scan est en cours. Voulez-vous revenir au relevé ? Les objets déjà validés seront conservés."
        );

      if (!confirmed) {
        return;
      }
    }

    returnToSurveySummary();
  }

  /**
   * Réinitialise l'interaction du scan.
   */
  function resetScanInteractionState() {
    latestAnalysisResult = null;
    selectedPrediction = null;

    scanPausedForConfirmation =
      false;

    quantityModeIsOpen = false;
    selectedQuantity = 1;
    lastAddedItemId = null;

    window.HeliaAI
      ?.resetStability?.();
  }

  /**
   * Affiche le récapitulatif général.
   */
  function renderSurveySummaryScreen() {
    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    if (survey.localCount === 0) {
      openCreateLocalScreen();
      return;
    }

    const page = createElement(
      "main",
      {
        className: "screen",
      }
    );

    const header =
      createScreenHeader({
        title: "Relevé",

        onBack: () => {
          summaryFeedbackMessage =
            "";

          surveyInformationFormIsOpen =
            false;

          window.HeliaNavigation
            .navigateTo(
              window.HELIA_SCREENS
                .HOME
            );
        },
      });

    const content =
      createElement(
        "section",
        {
          className:
            "content-card",
        }
      );

    const surveyBadge =
      createElement(
        "div",
        {
          className:
            "local-badge",

          textContent:
            survey.displayName,
        }
      );

    const totalTitle =
      createElement(
        "h2",
        {
          className:
            "summary-title",

          textContent:
            `${formatLocalCount(
              survey.localCount
            )} · ` +
            formatInventoryTotal(
              survey.totalQuantity
            ),
        }
      );

    const saveInformation =
      createElement(
        "p",
        {
          className:
            "screen-introduction",

          textContent:
            "Le relevé et ses locaux sont sauvegardés automatiquement sur cet appareil.",
        }
      );

    content.append(
      surveyBadge,
      totalTitle,
      saveInformation
    );

    if (summaryFeedbackMessage) {
      content.append(
        createElement(
          "div",
          {
            className:
              "inline-alert",

            textContent:
              summaryFeedbackMessage,

            attributes: {
              role: "status",

              "aria-live":
                "polite",
            },
          }
        )
      );
    }

    const informationSection =
      createSurveyInformationSummary(
        survey
      );

    content.append(
      informationSection
    );

    if (
      surveyInformationFormIsOpen
    ) {
      content.append(
        createSurveyInformationEditor(
          survey
        )
      );
    }

    const actionsSection =
      createElement(
        "section",
        {
          className:
            "field-group",

          attributes: {
            "aria-labelledby":
              "survey-actions-title",
          },
        }
      );

    const actionsTitle =
      createElement(
        "h3",
        {
          id:
            "survey-actions-title",

          className:
            "field-label",

          textContent:
            "Actions du relevé",
        }
      );

    const addLocalButton =
      createButton({
        label:
          "Ajouter un autre local",

        className:
          "button button-primary button-large",

        onClick:
          openCreateLocalScreen,
      });

    const exportCsvButton =
      createButton({
        label:
          "Exporter le relevé en CSV",

        className:
          "button button-secondary",

        onClick: () => {
          exportCurrentSurvey(
            "csv"
          );
        },
      });

    const exportJsonButton =
      createButton({
        label:
          "Exporter le relevé en JSON",

        className:
          "button button-secondary",

        onClick: () => {
          exportCurrentSurvey(
            "json"
          );
        },
      });

    const homeButton =
      createButton({
        label:
          "Terminer et revenir à l'accueil",

        className:
          "button button-secondary",

        onClick:
          finishAndReturnToHome,
      });

    actionsSection.append(
      actionsTitle,
      addLocalButton,
      exportCsvButton,
      exportJsonButton,
      homeButton
    );

    const localsTitle =
      createElement(
        "h3",
        {
          className:
            "field-label",

          textContent:
            "Locaux du relevé",
        }
      );

    const localList =
      createSurveyLocalList(
        survey.locals
      );

    const resetSurveyButton =
      createButton({
        label:
          "Effacer tout le relevé",

        className:
          "button button-secondary",

        onClick:
          confirmAndResetSurvey,
      });

    content.append(
      actionsSection,
      localsTitle,
      localList,
      resetSurveyButton
    );

    page.append(
      header,
      content
    );

    appElement.append(page);
  }

  /**
   * Affiche la synthèse des informations générales.
   *
   * @param {Object} survey Relevé.
   * @returns {HTMLElement}
   */
  function createSurveyInformationSummary(
    survey
  ) {
    const section =
      createElement(
        "section",
        {
          className:
            "summary-item",

          attributes: {
            "aria-labelledby":
              "survey-summary-information-title",
          },
        }
      );

    const title =
      createElement(
        "h3",
        {
          id:
            "survey-summary-information-title",

          className:
            "field-label",

          textContent:
            "Identification du relevé",
        }
      );

    section.append(title);

    const rows = [
      [
        "Nom",
        survey.name,
      ],

      [
        "Référence",
        survey.reference,
      ],

      [
        "Site",
        survey.site,
      ],

      [
        "Bâtiment",
        survey.building,
      ],

      [
        "Étage ou niveau",
        survey.level,
      ],

      [
        "Unité ou service",
        survey.unit,
      ],

      [
        "Opérateur",
        survey.operatorName,
      ],

      [
        "Date",
        formatDateOnly(
          survey.surveyDate
        ),
      ],

      [
        "Notes",
        survey.notes,
      ],
    ].filter(
      ([, value]) =>
        Boolean(value)
    );

    if (rows.length === 0) {
      section.append(
        createElement(
          "p",
          {
            className:
              "screen-introduction",

            textContent:
              "Aucune information descriptive n'a encore été enregistrée.",
          }
        )
      );
    } else {
      const list =
        createElement(
          "div",
          {
            className:
              "field-group",
          }
        );

      rows.forEach(
        ([label, value]) => {
          const row =
            createElement(
              "div",
              {
                className:
                  "summary-item-information",
              }
            );

          row.append(
            createElement(
              "strong",
              {
                className:
                  "summary-item-label",

                textContent:
                  label,
              }
            ),

            createElement(
              "span",
              {
                className:
                  "summary-item-details",

                textContent:
                  value,
              }
            )
          );

          list.append(row);
        }
      );

      section.append(list);
    }

    const editButton =
      createButton({
        label:
          surveyInformationFormIsOpen
            ? "Fermer le formulaire"
            : survey.hasInformation
              ? "Modifier les informations"
              : "Compléter les informations",

        className:
          "button button-secondary",

        onClick: () => {
          surveyInformationFormIsOpen =
            !surveyInformationFormIsOpen;

          summaryFeedbackMessage =
            "";

          renderScreen(
            window.HELIA_SCREENS
              .SUMMARY
          );
        },
      });

    section.append(
      editButton
    );

    return section;
  }

  /**
   * Crée le formulaire d'édition des informations générales.
   *
   * @param {Object} survey Relevé.
   * @returns {HTMLElement}
   */
  function createSurveyInformationEditor(
    survey
  ) {
    const form =
      createElement(
        "form",
        {
          className:
            "summary-item",

          attributes: {
            novalidate: "",

            "aria-labelledby":
              "survey-editor-title",
          },
        }
      );

    const title =
      createElement(
        "h3",
        {
          id:
            "survey-editor-title",

          className:
            "field-label",

          textContent:
            "Modifier la fiche du relevé",
        }
      );

    const fields =
      createSurveyInformationFields(
        survey,
        {
          nameIsRequired: true,
        }
      );

    const saveButton =
      createButton({
        label:
          "Enregistrer les informations",

        className:
          "button button-primary",

        attributes: {
          type: "submit",
        },
      });

    const cancelButton =
      createButton({
        label: "Annuler",

        className:
          "button button-secondary",

        onClick: () => {
          surveyInformationFormIsOpen =
            false;

          summaryFeedbackMessage =
            "";

          renderScreen(
            window.HELIA_SCREENS
              .SUMMARY
          );
        },
      });

    form.append(
      title,
      fields,
      saveButton,
      cancelButton
    );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        saveSurveyInformation();
      }
    );

    return form;
  }

  /**
   * Enregistre la fiche du relevé.
   */
  function saveSurveyInformation() {
    clearAllVisibleFieldErrors();

    try {
      const information =
        collectSurveyInformation({
          requireName: true,
        });

      window.HeliaInventory
        .setSurveyInformation(
          information
        );

      surveyInformationFormIsOpen =
        false;

      summaryFeedbackMessage =
        "Les informations du relevé ont été enregistrées.";

      renderScreen(
        window.HELIA_SCREENS
          .SUMMARY
      );
    } catch (error) {
      if (
        error?.code ===
          "MISSING_SURVEY_NAME" ||
        error?.code ===
          "INVALID_SURVEY_DATE"
      ) {
        return;
      }

      console.error(
        "Impossible d'enregistrer les informations du relevé :",
        error
      );

      summaryFeedbackMessage =
        error.message ||
        "Les informations du relevé n'ont pas pu être enregistrées.";
    }
  }

  /**
   * Crée la liste des locaux.
   *
   * @param {Array<Object>} locals Locaux.
   * @returns {HTMLElement}
   */
  function createSurveyLocalList(
    locals
  ) {
    const list =
      createElement(
        "div",
        {
          className:
            "summary-list",
        }
      );

    locals.forEach(
      (local) => {
        list.append(
          createSurveyLocalCard(
            local
          )
        );
      }
    );

    return list;
  }

  /**
   * Crée la carte d'un local.
   *
   * @param {Object} local Local.
   * @returns {HTMLElement}
   */
  function createSurveyLocalCard(
    local
  ) {
    const card =
      createElement(
        "article",
        {
          className:
            "summary-item",
        }
      );

    const information =
      createElement(
        "div",
        {
          className:
            "summary-item-information",
        }
      );

    information.append(
      createElement(
        "strong",
        {
          className:
            "summary-item-label",

          textContent:
            local.identifier,
        }
      ),

      createElement(
        "span",
        {
          className:
            "summary-item-details",

          textContent:
            `${formatInventoryTotal(
              local.totalQuantity
            )} · ` +
            formatLocalStatus(
              local.status
            ),
        }
      )
    );

    const actions =
      createElement(
        "div",
        {
          className:
            "field-group",
        }
      );

    const resumeButton =
      createButton({
        label:
          local.totalQuantity > 0
            ? "Reprendre ce local"
            : "Scanner ce local",

        className:
          "button button-primary",

        onClick: (event) => {
          void resumeLocalScan(
            local.id,
            event.currentTarget
          );
        },
      });

    const removeButton =
      createButton({
        label:
          "Supprimer ce local",

        className:
          "button button-secondary",

        onClick: () => {
          removeSurveyLocal(
            local.id
          );
        },
      });

    actions.append(
      resumeButton,
      removeButton
    );

    card.append(
      information,
      actions,

      createElement(
        "strong",
        {
          className:
            "quantity-title",

          textContent:
            "Objets enregistrés",
        }
      )
    );

    if (
      local.items.length === 0
    ) {
      card.append(
        createElement(
          "p",
          {
            className:
              "screen-introduction",

            textContent:
              "Aucun objet dans ce local.",
          }
        )
      );
    } else {
      card.append(
        createLocalItemList(
          local
        )
      );
    }

    return card;
  }

  /**
   * Crée la liste des objets d'un local.
   *
   * @param {Object} local Local.
   * @returns {HTMLElement}
   */
  function createLocalItemList(
    local
  ) {
    const list =
      createElement(
        "div",
        {
          className:
            "summary-list",
        }
      );

    local.items.forEach(
      (item) => {
        const itemCard =
          createElement(
            "article",
            {
              className:
                "summary-item",
            }
          );

        const information =
          createElement(
            "div",
            {
              className:
                "summary-item-information",
            }
          );

        information.append(
          createElement(
            "strong",
            {
              className:
                "summary-item-label",

              textContent:
                item.label,
            }
          ),

          createElement(
            "span",
            {
              className:
                "summary-item-details",

              textContent:
                item.confidence ===
                null
                  ? "Ajout manuel"
                  : `Confiance IA : ${formatPercentage(
                      item.confidence *
                        100
                    )}`,
            }
          )
        );

        const quantityControls =
          createElement(
            "div",
            {
              className:
                "summary-quantity-controls",
            }
          );

        const minusButton =
          createButton({
            label: "−",

            className:
              "button quantity-button",

            disabled:
              item.quantity <= 1,

            attributes: {
              "aria-label":
                `Diminuer la quantité de ${item.label} dans ${local.identifier}`,
            },

            onClick: () => {
              updateSurveyItemQuantity(
                local.id,
                item.id,
                item.quantity - 1
              );
            },
          });

        const quantity =
          createElement(
            "strong",
            {
              className:
                "summary-item-quantity",

              textContent:
                String(
                  item.quantity
                ),
            }
          );

        const plusButton =
          createButton({
            label: "+",

            className:
              "button quantity-button",

            attributes: {
              "aria-label":
                `Augmenter la quantité de ${item.label} dans ${local.identifier}`,
            },

            onClick: () => {
              updateSurveyItemQuantity(
                local.id,
                item.id,
                item.quantity + 1
              );
            },
          });

        quantityControls.append(
          minusButton,
          quantity,
          plusButton
        );

        const deleteButton =
          createButton({
            label: "Supprimer",

            className:
              "button button-secondary",

            onClick: () => {
              removeSurveyItem(
                local.id,
                item.id
              );
            },
          });

        itemCard.append(
          information,
          quantityControls,
          deleteButton
        );

        list.append(
          itemCard
        );
      }
    );

    return list;
  }

  /**
   * Exporte le relevé.
   *
   * @param {"csv"|"json"} format Format.
   */
  function exportCurrentSurvey(
    format
  ) {
    try {
      const result =
        format === "csv"
          ? window.HeliaExport
              .exportSurveyCsv()
          : window.HeliaExport
              .exportSurveyJson();

      summaryFeedbackMessage =
        `Le fichier « ${result.filename} » a été préparé pour le téléchargement.`;

      renderScreen(
        window.HELIA_SCREENS
          .SUMMARY
      );
    } catch (error) {
      console.error(
        "Erreur durant l'export du relevé :",
        error
      );

      summaryFeedbackMessage =
        error.message ||
        "Le relevé n'a pas pu être exporté.";

      renderScreen(
        window.HELIA_SCREENS
          .SUMMARY
      );
    }
  }

  /**
   * Revient à l'accueil sans effacer le relevé.
   */
  function finishAndReturnToHome() {
    stopPredictionLoop();
    window.HeliaCamera.stop();

    if (
      window.HeliaInventory
        .isScanActive()
    ) {
      window.HeliaInventory
        .stopScan();
    }

    resetScanInteractionState();

    cameraErrorMessage = "";
    summaryFeedbackMessage = "";

    surveyInformationFormIsOpen =
      false;

    window.HeliaNavigation
      .navigateTo(
        window.HELIA_SCREENS
          .HOME
      );
  }

  /**
   * Modifie la quantité d'un objet.
   *
   * @param {string} localId Local.
   * @param {string} itemId Objet.
   * @param {number} quantity Quantité.
   */
  function updateSurveyItemQuantity(
    localId,
    itemId,
    quantity
  ) {
    try {
      window.HeliaInventory
        .updateItemQuantity(
          itemId,
          quantity,
          localId
        );

      summaryFeedbackMessage =
        "La quantité a été mise à jour et sauvegardée.";
    } catch (error) {
      summaryFeedbackMessage =
        error.message ||
        "La quantité n'a pas pu être modifiée.";
    }

    renderScreen(
      window.HELIA_SCREENS
        .SUMMARY
    );
  }

  /**
   * Supprime un objet.
   *
   * @param {string} localId Local.
   * @param {string} itemId Objet.
   */
  function removeSurveyItem(
    localId,
    itemId
  ) {
    const confirmed =
      window.confirm(
        "Supprimer cet objet de ce local ?"
      );

    if (!confirmed) {
      return;
    }

    const removed =
      window.HeliaInventory
        .removeItem(
          itemId,
          localId
        );

    summaryFeedbackMessage =
      removed
        ? "L'objet a été supprimé du local."
        : "L'objet n'a pas été trouvé.";

    renderScreen(
      window.HELIA_SCREENS
        .SUMMARY
    );
  }

  /**
   * Supprime un local.
   *
   * @param {string} localId Identifiant.
   */
  function removeSurveyLocal(
    localId
  ) {
    const local =
      window.HeliaInventory
        .getLocalSnapshot(
          localId
        );

    if (!local) {
      summaryFeedbackMessage =
        "Le local n'a pas été trouvé.";

      renderScreen(
        window.HELIA_SCREENS
          .SUMMARY
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Supprimer le local « ${local.identifier} » et tous ses objets ?`
      );

    if (!confirmed) {
      return;
    }

    const removed =
      window.HeliaInventory
        .removeLocal(
          localId
        );

    if (!removed) {
      summaryFeedbackMessage =
        "Le local n'a pas pu être supprimé.";

      renderScreen(
        window.HELIA_SCREENS
          .SUMMARY
      );

      return;
    }

    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    if (
      survey.localCount === 0
    ) {
      openCreateLocalScreen();
      return;
    }

    summaryFeedbackMessage =
      "Le local a été supprimé du relevé.";

    renderScreen(
      window.HELIA_SCREENS
        .SUMMARY
    );
  }

  /**
   * Efface le relevé complet.
   */
  function confirmAndResetSurvey() {
    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    if (
      survey.localCount > 0
    ) {
      const confirmed =
        window.confirm(
          "Cette action effacera tous les locaux, tous les objets et les informations du relevé. Continuer ?"
        );

      if (!confirmed) {
        return;
      }
    }

    stopPredictionLoop();
    window.HeliaCamera.stop();

    window.HeliaInventory
      .resetSurvey();

    resetScanInteractionState();

    cameraErrorMessage = "";
    summaryFeedbackMessage = "";

    surveyInformationFormIsOpen =
      false;

    openCreateLocalScreen();
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
      case window.HeliaInventory
        .SCAN_STATUS.SCANNING:
        return "Scan en cours";

      case window.HeliaInventory
        .SCAN_STATUS.PAUSED:
        return "À reprendre";

      case window.HeliaInventory
        .SCAN_STATUS.COMPLETED:
        return "Terminé";

      case window.HeliaInventory
        .SCAN_STATUS.READY:
        return "Prêt à scanner";

      default:
        return "Non commencé";
    }
  }

  /**
   * Formate une date YYYY-MM-DD.
   *
   * @param {string} dateValue Date.
   * @returns {string}
   */
  function formatDateOnly(
    dateValue
  ) {
    if (!dateValue) {
      return "";
    }

    const parts =
      dateValue.split("-");

    if (parts.length !== 3) {
      return dateValue;
    }

    return (
      `${parts[2]}/` +
      `${parts[1]}/` +
      parts[0]
    );
  }

  /**
   * Normalise une quantité.
   *
   * @param {unknown} value Valeur.
   * @returns {number}
   */
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
      999
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
    return count === 1
      ? "1 local"
      : `${count} locaux`;
  }

  /**
   * Formate le nombre total d'objets.
   *
   * @param {number} total Total.
   * @returns {string}
   */
  function formatInventoryTotal(
    total
  ) {
    return total === 1
      ? "1 objet enregistré"
      : `${total} objets enregistrés`;
  }

  /**
   * Formate le message après validation.
   *
   * @param {string} className Classe.
   * @param {number} quantity Quantité.
   * @returns {string}
   */
  function formatAddedObjectMessage(
    className,
    quantity
  ) {
    if (quantity === 1) {
      return `« ${className} » a été ajouté.`;
    }

    return (
      `${quantity} × « ${className} » ` +
      "ont été ajoutés."
    );
  }

  /**
   * Formate un pourcentage.
   *
   * @param {number} percentage Pourcentage.
   * @returns {string}
   */
  function formatPercentage(
    percentage
  ) {
    const numericValue =
      Number(percentage);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return "0 %";
    }

    return `${numericValue
      .toFixed(1)
      .replace(".", ",")} %`;
  }

  /**
   * Crée un en-tête.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createScreenHeader({
    title,
    onBack,
  }) {
    const header =
      createElement(
        "header",
        {
          className:
            "screen-header",
        }
      );

    const backButton =
      createButton({
        label: "Retour",

        className:
          "button button-icon",

        onClick: onBack,

        attributes: {
          "aria-label":
            "Revenir à l'écran précédent",
        },
      });

    const heading =
      createElement(
        "h1",
        {
          className:
            "screen-title",

          textContent: title,
        }
      );

    header.append(
      backButton,
      heading
    );

    return header;
  }

  /**
   * Place un bouton en chargement.
   *
   * @param {HTMLButtonElement} button Bouton.
   * @param {string} label Texte.
   */
  function setButtonLoading(
    button,
    label
  ) {
    if (!button) {
      return;
    }

    button.disabled = true;
    button.textContent = label;

    button.classList.add(
      "button-loading"
    );

    button.setAttribute(
      "aria-busy",
      "true"
    );
  }

  /**
   * Crée un bouton.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLButtonElement}
   */
  function createButton({
    label,
    className,
    onClick,
    disabled = false,
    attributes = {},
  }) {
    const button =
      createElement(
        "button",
        {
          className,

          textContent:
            label,

          attributes: {
            type: "button",
            ...attributes,
          },
        }
      );

    button.disabled =
      disabled;

    if (
      typeof onClick ===
      "function"
    ) {
      button.addEventListener(
        "click",
        onClick
      );
    }

    return button;
  }

  /**
   * Crée un élément HTML.
   *
   * @param {string} tagName Balise.
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createElement(
    tagName,
    {
      id = "",
      className = "",
      textContent = "",
      attributes = {},
    } = {}
  ) {
    const element =
      document.createElement(
        tagName
      );

    if (id) {
      element.id = id;
    }

    if (className) {
      element.className =
        className;
    }

    if (
      textContent !== "" &&
      textContent !== null &&
      textContent !== undefined
    ) {
      element.textContent =
        String(textContent);
    }

    Object.entries(
      attributes
    ).forEach(
      ([attributeName, value]) => {
        element.setAttribute(
          attributeName,
          String(value)
        );
      }
    );

    return element;
  }

  /**
   * Affiche une erreur générale.
   *
   * @param {string} message Message.
   */
  function renderErrorScreen(
    message
  ) {
    appElement.append(
      createElement(
        "div",
        {
          className:
            "error-panel",

          textContent:
            message,

          attributes: {
            role: "alert",
          },
        }
      )
    );
  }

  /**
   * Affiche une erreur sous un champ.
   *
   * @param {HTMLElement} input Champ.
   * @param {string} message Message.
   */
  function displayFieldError(
    input,
    message
  ) {
    clearFieldError(input);

    const errorId =
      `${input.id}-error`;

    input.classList.add(
      "text-input-error"
    );

    input.setAttribute(
      "aria-invalid",
      "true"
    );

    input.setAttribute(
      "aria-describedby",
      errorId
    );

    const errorElement =
      createElement(
        "p",
        {
          id: errorId,

          className:
            "field-error",

          textContent:
            message,

          attributes: {
            role: "alert",
          },
        }
      );

    input.insertAdjacentElement(
      "afterend",
      errorElement
    );
  }

  /**
   * Supprime l'erreur d'un champ.
   *
   * @param {HTMLElement} input Champ.
   */
  function clearFieldError(input) {
    if (!input?.id) {
      return;
    }

    const errorId =
      `${input.id}-error`;

    document
      .getElementById(
        errorId
      )
      ?.remove();

    input.classList.remove(
      "text-input-error"
    );

    input.removeAttribute(
      "aria-invalid"
    );

    input.removeAttribute(
      "aria-describedby"
    );
  }

  /**
   * Supprime toutes les erreurs visibles.
   */
  function clearAllVisibleFieldErrors() {
    document
      .querySelectorAll(
        ".text-input-error"
      )
      .forEach(
        (input) => {
          clearFieldError(input);
        }
      );

    document
      .querySelectorAll(
        ".field-error"
      )
      .forEach(
        (element) => {
          element.remove();
        }
      );
  }

  /**
   * Crée une erreur interne d'interface.
   *
   * @param {string} code Code.
   * @param {string} message Message.
   * @returns {Error}
   */
  function createUIError(
    code,
    message
  ) {
    const error =
      new Error(message);

    error.name =
      "HeliaUIError";

    error.code = code;

    return error;
  }

  /**
   * Vérifie que l'interface est initialisée.
   */
  function ensureInitialized() {
    if (!appElement) {
      throw new Error(
        "HeliaUI doit être initialisé avant l'affichage d'un écran."
      );
    }
  }

  return Object.freeze({
    initialize,
    renderScreen,
  });
})();