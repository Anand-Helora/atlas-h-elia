"use strict";

/**
 * Interface de partage du relevé ATLAS H-ELIA.
 *
 * Cette version :
 * - reconnaît le panneau historique du récapitulatif ;
 * - reconnaît le nouveau panneau créé par summary-design.js ;
 * - déplace le bouton existant au lieu de le recréer ;
 * - évite les doublons lors des reconstructions du DOM ;
 * - conserve le partage CSV + JSON assuré par HeliaShare ;
 * - harmonise les messages avec le thème sombre H-ELIA.
 */
window.HeliaShareUI = (() => {
  const APP_ELEMENT_ID =
    "app";

  const MODERN_SUMMARY_PAGE_SELECTOR =
    ".helia-summary-page";

  const MODERN_OPTIONS_PANEL_SELECTOR =
    ".helia-summary-options-panel";

  const LEGACY_OPTIONS_PANEL_SELECTOR =
    '[data-helia-survey-options-panel="true"]';

  const SHARE_BUTTON_ATTRIBUTE =
    "data-helia-share-survey-button";

  const SHARE_STATUS_ATTRIBUTE =
    "data-helia-share-status";

  const STYLE_ELEMENT_ID =
    "helia-share-ui-styles";

  let appElement =
    null;

  let observer =
    null;

  let enhancementScheduled =
    false;

  let enhancementInProgress =
    false;

  let sharingIsInProgress =
    false;

  /**
   * Initialise le module.
   *
   * @param {string} appElementId
   * Identifiant du conteneur principal.
   */
  function initialize(
    appElementId = APP_ELEMENT_ID
  ) {
    if (observer) {
      return;
    }

    validateDependencies();
    injectStyles();

    appElement =
      document.getElementById(
        appElementId
      );

    if (!appElement) {
      console.warn(
        `Le module de partage attend le conteneur #${appElementId}.`
      );

      return;
    }

    observer =
      new MutationObserver(
        scheduleEnhancement
      );

    observeApplication();
    enhanceCurrentScreen();
  }

  /**
   * Vérifie que le module métier
   * de partage est disponible.
   */
  function validateDependencies() {
    if (!window.HeliaShare) {
      throw new Error(
        "HeliaShare doit être chargé avant share-ui.js."
      );
    }
  }

  /**
   * Active l'observation du DOM.
   */
  function observeApplication() {
    if (
      !observer ||
      !appElement
    ) {
      return;
    }

    observer.observe(
      appElement,
      {
        childList: true,
        subtree: true,
      }
    );
  }

  /**
   * Ajoute les styles du bouton
   * et des messages de résultat.
   */
  function injectStyles() {
    document
      .getElementById(
        STYLE_ELEMENT_ID
      )
      ?.remove();

    const styleElement =
      document.createElement(
        "style"
      );

    styleElement.id =
      STYLE_ELEMENT_ID;

    styleElement.textContent = `
      [data-helia-share-survey-button="true"] {
        width: 100% !important;
        max-width: none !important;
        min-height: 47px;
      }

      [data-helia-share-survey-button="true"]:disabled {
        cursor: wait;
        opacity: 0.72;
      }

      .helia-share-status {
        grid-column: 1 / -1;

        width: 100%;

        margin: 0;
        padding: 12px 14px;

        border:
          1px solid
          rgb(55 221 212 / 28%);

        border-radius: 12px;

        color:
          var(
            --hs-muted,
            #d8eaec
          );

        background:
          rgb(0 24 29 / 58%);

        font-size: 0.86rem;
        font-weight: 520;
        line-height: 1.5;

        overflow-wrap: anywhere;
      }

      .helia-share-status-success {
        border-color:
          rgb(85 230 155 / 42%);

        color:
          #c8fce0;

        background:
          rgb(85 230 155 / 9%);
      }

      .helia-share-status-error {
        border-color:
          rgb(255 124 104 / 44%);

        color:
          #ffb2a4;

        background:
          rgb(255 124 104 / 8%);
      }
    `;

    document.head.append(
      styleElement
    );
  }

  /**
   * Regroupe les modifications successives
   * du DOM en une seule vérification.
   */
  function scheduleEnhancement() {
    if (
      enhancementScheduled ||
      enhancementInProgress
    ) {
      return;
    }

    enhancementScheduled =
      true;

    window.requestAnimationFrame(
      () => {
        enhancementScheduled =
          false;

        enhanceCurrentScreen();
      }
    );
  }

  /**
   * Recherche le panneau des options du relevé
   * et y place le bouton de partage.
   */
  function enhanceCurrentScreen() {
    if (
      !appElement ||
      enhancementInProgress
    ) {
      return;
    }

    const optionsPanel =
      findSurveyOptionsPanel();

    if (!optionsPanel) {
      return;
    }

    enhancementInProgress =
      true;

    /*
     * On suspend temporairement l'observateur
     * pendant nos propres déplacements du DOM.
     */
    observer?.disconnect();

    try {
      let shareButton =
        appElement.querySelector(
          `[${SHARE_BUTTON_ATTRIBUTE}="true"]`
        );

      /*
       * Le bouton peut déjà exister dans l'ancien
       * panneau masqué. Dans ce cas, il est déplacé
       * sans perdre son écouteur de clic.
       */
      if (!shareButton) {
        shareButton =
          createShareButton();
      }

      shareButton.classList.add(
        "helia-summary-option-button"
      );

      if (
        shareButton.parentElement !==
        optionsPanel
      ) {
        optionsPanel.prepend(
          shareButton
        );
      }

      /*
       * Un éventuel message de partage est également
       * replacé dans le panneau actuellement utilisé.
       */
      const existingStatus =
        appElement.querySelector(
          `[${SHARE_STATUS_ATTRIBUTE}="true"]`
        );

      if (
        existingStatus &&
        existingStatus.parentElement !==
          optionsPanel
      ) {
        optionsPanel.append(
          existingStatus
        );
      }

      updateButtonState(
        shareButton
      );
    } finally {
      enhancementInProgress =
        false;

      observeApplication();
    }
  }

  /**
   * Recherche en priorité le nouveau panneau
   * créé par summary-design.js.
   *
   * Le panneau historique reste utilisé en secours
   * lorsque le nouveau design n'est pas encore prêt.
   *
   * @returns {HTMLElement|null}
   */
  function findSurveyOptionsPanel() {
    const modernSummaryPage =
      appElement.querySelector(
        MODERN_SUMMARY_PAGE_SELECTOR
      );

    const modernPanel =
      modernSummaryPage?.querySelector(
        MODERN_OPTIONS_PANEL_SELECTOR
      );

    if (modernPanel) {
      return modernPanel;
    }

    return (
      appElement.querySelector(
        LEGACY_OPTIONS_PANEL_SELECTOR
      ) ?? null
    );
  }

  /**
   * Crée le bouton de partage.
   *
   * @returns {HTMLButtonElement}
   */
  function createShareButton() {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "button button-primary helia-summary-option-button";

    button.textContent =
      "Partager le relevé";

    button.setAttribute(
      SHARE_BUTTON_ATTRIBUTE,
      "true"
    );

    button.setAttribute(
      "aria-label",
      "Partager les fichiers CSV et JSON du relevé"
    );

    button.addEventListener(
      "click",
      () => {
        const optionsPanel =
          button.closest(
            MODERN_OPTIONS_PANEL_SELECTOR
          ) ||
          button.closest(
            LEGACY_OPTIONS_PANEL_SELECTOR
          );

        if (!optionsPanel) {
          console.error(
            "Le panneau des options du relevé est introuvable."
          );

          return;
        }

        handleShareRequest({
          button,
          optionsPanel,
        });
      }
    );

    return button;
  }

  /**
   * Lance le partage après le clic.
   *
   * @param {Object} options Paramètres.
   */
  async function handleShareRequest({
    button,
    optionsPanel,
  }) {
    if (sharingIsInProgress) {
      return;
    }

    sharingIsInProgress =
      true;

    removeStatusMessage(
      optionsPanel
    );

    updateButtonState(
      button
    );

    try {
      const result =
        await window.HeliaShare
          .shareSurveyFiles();

      if (
        result.status ===
        "cancelled"
      ) {
        displayStatusMessage({
          optionsPanel,

          message:
            "Le partage a été annulé. Aucun fichier n’a été envoyé.",

          type:
            "neutral",
        });

        return;
      }

      const filenames =
        Array.isArray(
          result.filenames
        )
          ? result.filenames
          : [];

      const filenameText =
        filenames.length > 0
          ? ` Fichiers préparés : ${filenames.join(", ")}.`
          : "";

      displayStatusMessage({
        optionsPanel,

        message:
          "Les fichiers ont été transmis à l’application choisie." +
          filenameText,

        type:
          "success",
      });
    } catch (error) {
      console.error(
        "Le partage du relevé a échoué :",
        error
      );

      displayStatusMessage({
        optionsPanel,

        message:
          createUserErrorMessage(
            error
          ),

        type:
          "error",
      });
    } finally {
      sharingIsInProgress =
        false;

      updateButtonState(
        button
      );
    }
  }

  /**
   * Met à jour le bouton pendant
   * la préparation des fichiers.
   *
   * @param {HTMLButtonElement} button Bouton.
   */
  function updateButtonState(
    button
  ) {
    button.disabled =
      sharingIsInProgress;

    button.textContent =
      sharingIsInProgress
        ? "Préparation du partage…"
        : "Partager le relevé";

    button.setAttribute(
      "aria-busy",
      String(
        sharingIsInProgress
      )
    );
  }

  /**
   * Transforme une erreur technique
   * en message compréhensible.
   *
   * @param {unknown} error Erreur.
   * @returns {string}
   */
  function createUserErrorMessage(
    error
  ) {
    const code =
      String(
        error?.code ?? ""
      );

    if (
      code ===
      "INSECURE_CONTEXT"
    ) {
      return (
        "Le partage nécessite une adresse HTTPS. " +
        "Il fonctionnera depuis la version publiée et sécurisée de l’application."
      );
    }

    if (
      code ===
        "SHARE_API_UNAVAILABLE" ||
      code ===
        "CAN_SHARE_UNAVAILABLE"
    ) {
      return (
        "Ce navigateur ne possède pas de menu de partage compatible. " +
        "Utilisez les boutons CSV et JSON séparément."
      );
    }

    if (
      code ===
      "FILE_SHARING_UNSUPPORTED"
    ) {
      return (
        "Cet appareil ne permet pas de partager directement les deux fichiers. " +
        "Utilisez les exports CSV et JSON séparément."
      );
    }

    if (
      code ===
      "EMPTY_SURVEY"
    ) {
      return (
        "Ajoutez au moins un local avant de partager le relevé."
      );
    }

    if (error?.message) {
      return String(
        error.message
      );
    }

    return (
      "Le relevé n’a pas pu être partagé. " +
      "Les exports CSV et JSON restent disponibles séparément."
    );
  }

  /**
   * Affiche un message dans
   * le panneau des options.
   *
   * @param {Object} options Paramètres.
   */
  function displayStatusMessage({
    optionsPanel,
    message,
    type,
  }) {
    removeStatusMessage(
      optionsPanel
    );

    const statusElement =
      document.createElement(
        "p"
      );

    statusElement.className =
      "helia-share-status";

    if (
      type ===
      "success"
    ) {
      statusElement.classList.add(
        "helia-share-status-success"
      );
    } else if (
      type ===
      "error"
    ) {
      statusElement.classList.add(
        "helia-share-status-error"
      );
    }

    statusElement.textContent =
      message;

    statusElement.setAttribute(
      SHARE_STATUS_ATTRIBUTE,
      "true"
    );

    statusElement.setAttribute(
      "role",
      type === "error"
        ? "alert"
        : "status"
    );

    statusElement.setAttribute(
      "aria-live",
      type === "error"
        ? "assertive"
        : "polite"
    );

    optionsPanel.append(
      statusElement
    );
  }

  /**
   * Supprime l'ancien message.
   *
   * @param {HTMLElement} optionsPanel Panneau.
   */
  function removeStatusMessage(
    optionsPanel
  ) {
    optionsPanel
      .querySelector(
        `[${SHARE_STATUS_ATTRIBUTE}="true"]`
      )
      ?.remove();
  }

  /**
   * Force une nouvelle vérification.
   */
  function refresh() {
    enhanceCurrentScreen();
  }

  /**
   * Débranche le module.
   */
  function destroy() {
    observer?.disconnect();

    observer =
      null;

    appElement =
      null;

    enhancementScheduled =
      false;

    enhancementInProgress =
      false;

    sharingIsInProgress =
      false;
  }

  /**
   * Démarrage automatique.
   */
  function startAutomatically() {
    try {
      initialize();
    } catch (error) {
      console.error(
        "Le module d’interface de partage n’a pas pu démarrer :",
        error
      );
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startAutomatically,
      {
        once: true,
      }
    );
  } else {
    window.queueMicrotask(
      startAutomatically
    );
  }

  return Object.freeze({
    initialize,
    refresh,
    destroy,
  });
})();