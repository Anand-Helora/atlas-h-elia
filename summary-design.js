"use strict";

/**
 * Design et interactions du récapitulatif ATLAS H-ELIA.
 *
 * Ce module possède directement :
 * - la recherche des locaux ;
 * - l'accordéon des cartes locales ;
 * - l'accordéon « Options du relevé » ;
 * - le renommage d'un local ;
 * - l'habillage mobile sombre.
 *
 * Les boutons fonctionnels créés par ui.js et share-ui.js sont déplacés,
 * jamais clonés : leurs écouteurs d'origine restent donc attachés.
 */
window.HeliaSummaryDesign = (() => {
  const APP_ID = "app";
  const STYLE_ID =
    "helia-summary-design-styles";

  const SELECTOR = Object.freeze({
    page:
      "main.screen",

    content:
      ".content-card",

    localCard:
      "article.summary-item",
  });

  let appElement = null;
  let observer = null;

  let scheduled = false;
  let enhancing = false;

  let openLocalId = null;

  let surveyOptionsOpen =
    false;

  let surveyDetailsOpen =
    false;

  let searchQuery = "";

  /**
   * Initialise le module.
   *
   * @param {string} appId
   * Identifiant du conteneur principal.
   */
  function initialize(
    appId = APP_ID
  ) {
    if (observer) {
      return;
    }

    if (!window.HeliaInventory) {
      throw new Error(
        "HeliaInventory doit être chargé avant summary-design.js."
      );
    }

    stopConflictingModules();
    injectStyles();

    appElement =
      document.getElementById(
        appId
      );

    if (!appElement) {
      console.warn(
        `Le conteneur #${appId} est introuvable.`
      );

      return;
    }

    observer =
      new MutationObserver(
        scheduleEnhancement
      );

    observe();
    enhanceCurrentScreen();
  }

  /**
   * Arrête les anciens modules qui tentaient
   * de contrôler les mêmes éléments.
   *
   * share-ui.js reste volontairement actif.
   */
  function stopConflictingModules() {
    [
      "HeliaSummary",
      "HeliaSummarySearch",
      "HeliaSummarySort",
      "HeliaSummaryStats",
    ].forEach(
      (moduleName) => {
        try {
          window[moduleName]
            ?.destroy?.();
        } catch (error) {
          console.warn(
            `Le module ${moduleName} n'a pas pu être arrêté proprement.`,
            error
          );
        }
      }
    );
  }

  /**
   * Observe le conteneur de l'application.
   */
  function observe() {
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
   * Programme une actualisation unique.
   */
  function scheduleEnhancement() {
    if (
      scheduled ||
      enhancing
    ) {
      return;
    }

    scheduled = true;

    window.requestAnimationFrame(
      () => {
        scheduled = false;

        enhanceCurrentScreen();
      }
    );
  }

  /**
   * Prépare l'écran actuel.
   */
  function enhanceCurrentScreen() {
    if (
      !appElement ||
      enhancing
    ) {
      return;
    }

    const page =
      findSummaryPage();

    if (!page) {
      return;
    }

    const content =
      Array.from(
        page.children
      ).find(
        (child) =>
          child.classList
            ?.contains(
              "content-card"
            )
      );

    if (!content) {
      return;
    }

    enhancing = true;

    observer?.disconnect();

    try {
      const survey =
        window.HeliaInventory
          .getSurveySnapshot();

      preparePage(
        page,
        content
      );

      prepareOverview(
        content,
        survey
      );

      prepareSurveyDetails(
        content
      );

      const localEntries =
        prepareLocalCards(
          content,
          survey.locals || []
        );

      const localList =
        findLocalList(
          localEntries
        );

      const localTitle =
        findLocalTitle(
          content,
          localList
        );

      prepareSearch(
        content,
        localTitle,
        localList,
        localEntries
      );

      prepareSurveyActions(
        content,
        localList
      );

      hideLegacyControls(
        content
      );

      sortLocalCards(
        localList,
        localEntries
      );

      applyLocalStates(
        content
      );

      applySearch(
        localEntries
      );

      applySurveyDetailsState(
        content
      );

      applySurveyOptionsState(
        content
      );
    } catch (error) {
      console.error(
        "Le récapitulatif H-ELIA n'a pas pu être préparé :",
        error
      );
    } finally {
      enhancing = false;

      observe();
    }
  }

  /**
   * Recherche la page récapitulative.
   *
   * @returns {HTMLElement|null}
   */
  function findSummaryPage() {
    return (
      Array.from(
        appElement.querySelectorAll(
          SELECTOR.page
        )
      ).find(
        (page) => {
          const title =
            normalizeText(
              page.querySelector(
                ":scope > .screen-header .screen-title"
              )?.textContent
            );

          return (
            title === "releve" ||
            title.includes(
              "recapitulatif"
            )
          );
        }
      ) ?? null
    );
  }

  /**
   * Prépare la page et l'identité visuelle.
   *
   * @param {HTMLElement} page
   * Page.
   *
   * @param {HTMLElement} content
   * Contenu.
   */
  function preparePage(
    page,
    content
  ) {
    page.classList.add(
      "helia-summary-page"
    );

    content.classList.add(
      "helia-summary-content"
    );

    const header =
      page.querySelector(
        ":scope > .screen-header"
      );

    const title =
      header?.querySelector(
        ".screen-title"
      );

    if (title) {
      title.textContent =
        "Récapitulatif";
    }

    if (
      !page.querySelector(
        ":scope > .helia-summary-background"
      )
    ) {
      const background =
        createElement(
          "div",
          {
            className:
              "helia-summary-background",

            attributes: {
              "aria-hidden":
                "true",
            },
          }
        );

      background.innerHTML = `
        <svg
          viewBox="0 0 900 1800"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern
              id="helia-grid"
              width="42"
              height="42"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M42 0H0V42"
                fill="none"
                stroke="#23b8b1"
                stroke-width="0.6"
                opacity="0.22"
              ></path>
            </pattern>

            <linearGradient
              id="helia-line"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0"
                stop-color="#009e99"
                stop-opacity="0.06"
              ></stop>

              <stop
                offset="0.5"
                stop-color="#55e4dc"
                stop-opacity="0.55"
              ></stop>

              <stop
                offset="1"
                stop-color="#009e99"
                stop-opacity="0.05"
              ></stop>
            </linearGradient>
          </defs>

          <rect
            width="900"
            height="1800"
            fill="url(#helia-grid)"
          ></rect>

          <g
            fill="none"
            stroke="url(#helia-line)"
            stroke-width="1.2"
            opacity="0.48"
          >
            <path
              d="M-70 220 145 70 385 218 168 401Z"
            ></path>

            <path
              d="M650 140 920 40 930 390 700 470 650 410Z"
            ></path>

            <path
              d="M-40 1270 215 1075 510 1248 260 1460Z"
            ></path>

            <path
              d="M570 1320 790 1175 980 1295 750 1490Z"
            ></path>
          </g>
        </svg>
      `;

      page.prepend(
        background
      );
    }

    if (
      !page.querySelector(
        ":scope > .helia-summary-brand"
      )
    ) {
      const brand =
        createElement(
          "section",
          {
            className:
              "helia-summary-brand",

            attributes: {
              "aria-label":
                "ATLAS H-ELIA",
            },
          }
        );

      brand.innerHTML = `
        <div
          class="helia-summary-logo"
          aria-hidden="true"
        >
          <svg viewBox="0 0 190 160">
            <defs>
              <linearGradient
                id="helia-logo-a"
                x1="0"
                y1="1"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0"
                  stop-color="#18c7b0"
                ></stop>

                <stop
                  offset="1"
                  stop-color="#65e4cf"
                ></stop>
              </linearGradient>

              <linearGradient
                id="helia-logo-b"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop
                  offset="0"
                  stop-color="#1bbbd0"
                ></stop>

                <stop
                  offset="1"
                  stop-color="#006c76"
                ></stop>
              </linearGradient>
            </defs>

            <path
              d="M83 15C88 7 95 5 101 15L158 126C164 138 157 148 145 148H120L72 48Z"
              fill="url(#helia-logo-b)"
            ></path>

            <path
              d="M83 15C88 7 95 5 101 15L113 39 72 121C65 135 58 148 42 148H24C11 148 5 137 11 125Z"
              fill="url(#helia-logo-a)"
            ></path>
          </svg>
        </div>

        <div>
          <p class="helia-summary-suite">
            ATLAS
          </p>

          <p class="helia-summary-name">
            H-ELIA
          </p>

          <p class="helia-summary-subtitle">
            Synthèse du relevé et de ses locaux
          </p>
        </div>
      `;

      header?.insertAdjacentElement(
        "afterend",
        brand
      );
    }
  }

    /**
   * Crée la synthèse supérieure.
   *
   * @param {HTMLElement} content
   * Contenu.
   *
   * @param {Object} survey
   * Relevé.
   */
  function prepareOverview(
    content,
    survey
  ) {
    Array.from(
      content.children
    ).forEach(
      (child) => {
        const text =
          normalizeText(
            child.textContent
          );

        const shouldHide =
          child.classList
            ?.contains(
              "local-badge"
            ) ||
          (
            child.classList
              ?.contains(
                "summary-title"
              ) &&
            !text.includes(
              "locaux"
            )
          ) ||
          (
            child.classList
              ?.contains(
                "screen-introduction"
              ) &&
            text.includes(
              "sauvegarde"
            )
          );

        if (shouldHide) {
          child.classList.add(
            "helia-summary-hidden-legacy"
          );
        }
      }
    );

    let overview =
      content.querySelector(
        ":scope > .helia-summary-overview"
      );

    if (!overview) {
      overview =
        createElement(
          "section",
          {
            className:
              "helia-summary-overview",
          }
        );

      overview.innerHTML = `
        <p class="helia-summary-eyebrow">
          Relevé en cours
        </p>

        <h2 class="helia-summary-survey-name"></h2>

        <p class="helia-summary-meta"></p>

        <div class="helia-summary-stats">
          <div>
            <strong data-stat="locals">
              0
            </strong>

            <span>Locaux</span>
          </div>

          <div>
            <strong data-stat="types">
              0
            </strong>

            <span>Types</span>
          </div>

          <div>
            <strong data-stat="objects">
              0
            </strong>

            <span>Objets</span>
          </div>
        </div>
      `;

      content.prepend(
        overview
      );
    }

    const typeNames =
      new Set();

    let totalQuantity = 0;

    (
      survey.locals || []
    ).forEach(
      (local) => {
        (
          local.items || []
        ).forEach(
          (item) => {
            const label =
              normalizeText(
                item.label
              );

            if (label) {
              typeNames.add(
                label
              );
            }

            const quantity =
              Number(
                item.quantity
              );

            if (
              Number.isFinite(
                quantity
              )
            ) {
              totalQuantity +=
                Math.max(
                  0,
                  Math.trunc(
                    quantity
                  )
                );
            }
          }
        );
      }
    );

    setText(
      overview.querySelector(
        ".helia-summary-survey-name"
      ),

      survey.displayName ||
      survey.name ||
      "Relevé"
    );

    const metadata =
      [
        [
          formatDate(
            survey.surveyDate
          ),

          survey.reference
            ? `Réf. ${survey.reference}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),

        [
          survey.site,
          survey.building,
          survey.level,
          survey.unit,
        ]
          .filter(Boolean)
          .join(" · "),

        survey.operatorName
          ? `Opérateur : ${survey.operatorName}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

    const metaElement =
      overview.querySelector(
        ".helia-summary-meta"
      );

    setText(
      metaElement,
      metadata
    );

    if (metaElement) {
      metaElement.hidden =
        !metadata;
    }

    setText(
      overview.querySelector(
        '[data-stat="locals"]'
      ),

      survey.localCount || 0
    );

    setText(
      overview.querySelector(
        '[data-stat="types"]'
      ),

      typeNames.size
    );

    setText(
      overview.querySelector(
        '[data-stat="objects"]'
      ),

      totalQuantity
    );
  }

  /**
   * Prépare les détails du relevé.
   *
   * @param {HTMLElement} content
   * Contenu.
   */
  function prepareSurveyDetails(
    content
  ) {
    const detailsSection =
      content.querySelector(
        '[aria-labelledby="survey-summary-information-title"]'
      );

    if (!detailsSection) {
      return;
    }

    detailsSection.classList.add(
      "helia-summary-details-card"
    );

    let wrapper =
      content.querySelector(
        ":scope > .helia-summary-details-wrapper"
      );

    if (!wrapper) {
      wrapper =
        createElement(
          "section",
          {
            className:
              "helia-summary-details-wrapper",
          }
        );

      const toggle =
        createElement(
          "button",
          {
            className:
              "helia-summary-accordion-button",

            attributes: {
              type:
                "button",

              "data-role":
                "survey-details-toggle",
            },
          }
        );

      toggle.addEventListener(
        "click",
        () => {
          surveyDetailsOpen =
            !surveyDetailsOpen;

          applySurveyDetailsState(
            content
          );
        }
      );

      const panel =
        createElement(
          "div",
          {
            className:
              "helia-summary-details-panel",

            attributes: {
              "data-role":
                "survey-details-panel",
            },
          }
        );

      wrapper.append(
        toggle,
        panel
      );

      detailsSection
        .insertAdjacentElement(
          "beforebegin",
          wrapper
        );
    }

    const panel =
      wrapper.querySelector(
        '[data-role="survey-details-panel"]'
      );

    if (
      panel &&
      detailsSection.parentElement !==
        panel
    ) {
      panel.append(
        detailsSection
      );
    }
  }

  /**
   * Applique l'état des détails.
   *
   * @param {HTMLElement} content
   * Contenu.
   */
  function applySurveyDetailsState(
    content
  ) {
    const toggle =
      content.querySelector(
        '[data-role="survey-details-toggle"]'
      );

    const panel =
      content.querySelector(
        '[data-role="survey-details-panel"]'
      );

    if (
      !toggle ||
      !panel
    ) {
      return;
    }

    toggle.setAttribute(
      "aria-expanded",
      String(
        surveyDetailsOpen
      )
    );

    toggle.textContent =
      surveyDetailsOpen
        ? "Masquer les détails du relevé"
        : "Afficher les détails du relevé";

    panel.hidden =
      !surveyDetailsOpen;
  }

  /**
   * Identifie et prépare les cartes locales.
   *
   * @param {HTMLElement} content
   * Contenu.
   *
   * @param {Array<Object>} locals
   * Locaux.
   *
   * @returns {Array<Object>}
   */
  function prepareLocalCards(
    content,
    locals
  ) {
    if (
      openLocalId &&
      !locals.some(
        (local) =>
          local.id ===
          openLocalId
      )
    ) {
      openLocalId =
        null;
    }

    const candidates =
      Array.from(
        content.querySelectorAll(
          SELECTOR.localCard
        )
      );

    const used =
      new Set();

    const entries = [];

    locals.forEach(
      (local) => {
        const expectedName =
          normalizeText(
            local.identifier
          );

        const card =
          candidates.find(
            (candidate) => {
              if (
                used.has(
                  candidate
                )
              ) {
                return false;
              }

              const label =
                candidate.querySelector(
                  ":scope > .summary-item-information > .summary-item-label"
                );

              return (
                normalizeText(
                  label?.textContent
                ) ===
                expectedName
              );
            }
          );

        if (!card) {
          return;
        }

        used.add(
          card
        );

        card.classList.add(
          "helia-summary-local-card"
        );

        card.dataset.heliaLocalId =
          local.id;

        card.dataset.heliaSearchName =
          expectedName;

        prepareLocalCard(
          card,
          local
        );

        entries.push({
          card,
          local,
        });
      }
    );

    return entries;
  }

    /**
   * Prépare une carte locale.
   *
   * @param {HTMLElement} card
   * Carte.
   *
   * @param {Object} local
   * Local.
   */
  function prepareLocalCard(
    card,
    local
  ) {
    const information =
      card.querySelector(
        ":scope > .summary-item-information"
      );

    let toggle =
      card.querySelector(
        ":scope > .helia-summary-local-toggle"
      );

    if (!toggle) {
      toggle =
        createElement(
          "button",
          {
            className:
              "helia-summary-local-toggle",

            attributes: {
              type:
                "button",
            },
          }
        );

      toggle.addEventListener(
        "click",
        () => {
          openLocalId =
            openLocalId ===
            local.id
              ? null
              : local.id;

          applyLocalStates(
            card.closest(
              ".helia-summary-content"
            )
          );
        }
      );

      if (information) {
        information
          .insertAdjacentElement(
            "afterend",
            toggle
          );
      } else {
        card.prepend(
          toggle
        );
      }
    }

    let panel =
      card.querySelector(
        ":scope > .helia-summary-local-panel"
      );

    if (!panel) {
      panel =
        createElement(
          "div",
          {
            className:
              "helia-summary-local-panel",
          }
        );

      toggle.insertAdjacentElement(
        "afterend",
        panel
      );
    }

    const nativeActions =
      Array.from(
        card.children
      ).find(
        (child) => {
          if (
            !child.classList
              ?.contains(
                "field-group"
              )
          ) {
            return false;
          }

          return Array.from(
            child.querySelectorAll(
              "button"
            )
          ).some(
            (button) => {
              const text =
                normalizeText(
                  button.textContent
                );

              return (
                text ===
                  "reprendre ce local" ||
                text ===
                  "scanner ce local"
              );
            }
          );
        }
      );

    const objectList =
      Array.from(
        card.querySelectorAll(
          ".summary-list"
        )
      ).find(
        (list) =>
          Boolean(
            list.querySelector(
              ".summary-quantity-controls"
            )
          )
      );

    const objectTitle =
      Array.from(
        card.querySelectorAll(
          ".quantity-title"
        )
      ).find(
        (title) =>
          normalizeText(
            title.textContent
          ).includes(
            "objet"
          )
      );

    const emptyMessage =
      Array.from(
        card.querySelectorAll(
          ".screen-introduction, p"
        )
      ).find(
        (element) =>
          normalizeText(
            element.textContent
          ).includes(
            "aucun objet"
          )
      );

    let objectSection =
      panel.querySelector(
        ":scope > .helia-summary-object-section"
      );

    if (!objectSection) {
      objectSection =
        createElement(
          "section",
          {
            className:
              "helia-summary-panel-section helia-summary-object-section",
          }
        );

      objectSection.innerHTML =
        "<h3>Objets enregistrés</h3>";

      panel.append(
        objectSection
      );
    }

    objectTitle?.classList.add(
      "helia-summary-hidden-legacy"
    );

    if (objectList) {
      objectList.classList.add(
        "helia-summary-object-list"
      );

      Array.from(
        objectList.children
      ).forEach(
        (itemCard) => {
          itemCard.classList.add(
            "helia-summary-object-card"
          );
        }
      );

      if (
        objectList.parentElement !==
        objectSection
      ) {
        objectSection.append(
          objectList
        );
      }
    } else if (emptyMessage) {
      emptyMessage.classList.add(
        "helia-summary-empty-message"
      );

      if (
        emptyMessage.parentElement !==
        objectSection
      ) {
        objectSection.append(
          emptyMessage
        );
      }
    }

    let optionsSection =
      panel.querySelector(
        ":scope > .helia-summary-local-options"
      );

    if (!optionsSection) {
      optionsSection =
        createElement(
          "section",
          {
            className:
              "helia-summary-panel-section helia-summary-local-options",
          }
        );

      optionsSection.innerHTML =
        "<h3>Options du local</h3>";

      panel.append(
        optionsSection
      );
    }

    if (
      nativeActions &&
      nativeActions.parentElement !==
        optionsSection
    ) {
      nativeActions.classList.add(
        "helia-summary-native-local-actions"
      );

      optionsSection.append(
        nativeActions
      );
    }

    ensureRenameButton(
      optionsSection,
      card,
      local.id
    );
  }

  /**
   * Ajoute le bouton de renommage.
   *
   * @param {HTMLElement} optionsSection
   * Section.
   *
   * @param {HTMLElement} card
   * Carte.
   *
   * @param {string} localId
   * Identifiant.
   */
  function ensureRenameButton(
    optionsSection,
    card,
    localId
  ) {
    if (
      optionsSection.querySelector(
        ":scope > .helia-summary-rename-button"
      )
    ) {
      return;
    }

    const button =
      createElement(
        "button",
        {
          className:
            "button button-secondary helia-summary-rename-button",

          text:
            "Renommer ce local",

          attributes: {
            type:
              "button",
          },
        }
      );

    button.addEventListener(
      "click",
      () => {
        openRenameForm(
          optionsSection,
          card,
          localId,
          button
        );
      }
    );

    const nativeActions =
      optionsSection.querySelector(
        ":scope > .helia-summary-native-local-actions"
      );

    if (nativeActions) {
      nativeActions.insertAdjacentElement(
        "beforebegin",
        button
      );
    } else {
      optionsSection.append(
        button
      );
    }
  }

  /**
   * Ouvre le formulaire de renommage.
   *
   * @param {HTMLElement} optionsSection
   * Section.
   *
   * @param {HTMLElement} card
   * Carte.
   *
   * @param {string} localId
   * Identifiant.
   *
   * @param {HTMLButtonElement} renameButton
   * Bouton.
   */
  function openRenameForm(
    optionsSection,
    card,
    localId,
    renameButton
  ) {
    optionsSection
      .querySelector(
        ":scope > .helia-summary-rename-form"
      )
      ?.remove();

    const local =
      window.HeliaInventory
        .getLocalSnapshot(
          localId
        );

    if (!local) {
      return;
    }

    renameButton.hidden =
      true;

    const form =
      createElement(
        "form",
        {
          className:
            "helia-summary-rename-form",

          attributes: {
            novalidate:
              "",
          },
        }
      );

    const input =
      createElement(
        "input",
        {
          className:
            "text-input",

          attributes: {
            type:
              "text",

            maxlength:
              "120",

            autocomplete:
              "off",

            "aria-label":
              "Nouveau nom du local",
          },
        }
      );

    input.value =
      local.identifier;

    const errorMessage =
      createElement(
        "p",
        {
          className:
            "helia-summary-form-error",

          attributes: {
            role:
              "alert",
          },
        }
      );

    errorMessage.hidden =
      true;

    const buttons =
      createElement(
        "div",
        {
          className:
            "helia-summary-form-actions",
        }
      );

    const saveButton =
      createElement(
        "button",
        {
          className:
            "button button-primary",

          text:
            "Enregistrer",

          attributes: {
            type:
              "submit",
          },
        }
      );

    const cancelButton =
      createElement(
        "button",
        {
          className:
            "button button-secondary",

          text:
            "Annuler",

          attributes: {
            type:
              "button",
          },
        }
      );

    cancelButton.addEventListener(
      "click",
      () => {
        form.remove();

        renameButton.hidden =
          false;

        renameButton.focus();
      }
    );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const name =
          input.value
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (!name) {
          errorMessage.textContent =
            "Le nom du local ne peut pas être vide.";

          errorMessage.hidden =
            false;

          input.focus();

          return;
        }

        try {
          const updatedLocal =
            window.HeliaInventory
              .renameLocal(
                localId,
                name
              );

          const label =
            card.querySelector(
              ":scope > .summary-item-information > .summary-item-label"
            );

          if (label) {
            label.textContent =
              updatedLocal.identifier;
          }

          card.dataset.heliaSearchName =
            normalizeText(
              updatedLocal.identifier
            );

          form.remove();

          renameButton.hidden =
            false;

          scheduleEnhancement();
        } catch (error) {
          console.error(
            "Impossible de renommer le local :",
            error
          );

          errorMessage.textContent =
            error?.message ||
            "Le local n'a pas pu être renommé.";

          errorMessage.hidden =
            false;

          input.focus();
        }
      }
    );

    buttons.append(
      saveButton,
      cancelButton
    );

    form.append(
      input,
      errorMessage,
      buttons
    );

    renameButton
      .insertAdjacentElement(
        "afterend",
        form
      );

    window.requestAnimationFrame(
      () => {
        input.focus();
        input.select();
      }
    );
  }

  /**
   * Trouve la liste principale des locaux.
   *
   * @param {Array<Object>} entries
   * Cartes.
   *
   * @returns {HTMLElement|null}
   */
  function findLocalList(
    entries
  ) {
    const list =
      entries[0]
        ?.card
        ?.parentElement ??
      null;

    if (list) {
      list.classList.add(
        "helia-summary-local-list"
      );
    }

    return list;
  }

    /**
   * Trouve le titre des locaux.
   *
   * @param {HTMLElement} content
   * Contenu.
   *
   * @param {HTMLElement|null} localList
   * Liste.
   *
   * @returns {HTMLElement|null}
   */
  function findLocalTitle(
    content,
    localList
  ) {
    if (!localList) {
      return null;
    }

    const title =
      Array.from(
        content.querySelectorAll(
          ".field-label"
        )
      ).find(
        (element) =>
          normalizeText(
            element.textContent
          ).includes(
            "locaux"
          )
      );

    if (title) {
      title.textContent =
        "Locaux";

      title.classList.add(
        "helia-summary-locals-title"
      );
    }

    return title;
  }

  /**
   * Crée la recherche.
   *
   * @param {HTMLElement} content
   * Contenu.
   *
   * @param {HTMLElement|null} localTitle
   * Titre.
   *
   * @param {HTMLElement|null} localList
   * Liste.
   *
   * @param {Array<Object>} entries
   * Cartes.
   */
  function prepareSearch(
    content,
    localTitle,
    localList,
    entries
  ) {
    if (!localList) {
      return;
    }

    let zone =
      content.querySelector(
        ":scope > .helia-summary-search-zone"
      );

    if (!zone) {
      zone =
        createElement(
          "section",
          {
            className:
              "helia-summary-search-zone",
          }
        );

      const label =
        createElement(
          "label",
          {
            className:
              "helia-summary-search-label",

            text:
              "Rechercher un local",
          }
        );

      const input =
        createElement(
          "input",
          {
            className:
              "helia-summary-search-input",

            attributes: {
              type:
                "search",

              placeholder:
                "Nom ou identifiant du local",

              autocomplete:
                "off",

              enterkeyhint:
                "search",
            },
          }
        );

      const status =
        createElement(
          "p",
          {
            className:
              "helia-summary-search-status",

            attributes: {
              role:
                "status",

              "aria-live":
                "polite",
            },
          }
        );

      input.value =
        searchQuery;

      input.addEventListener(
        "input",
        () => {
          searchQuery =
            input.value;

          applySearch(
            getCurrentLocalEntries(
              content
            )
          );
        }
      );

      input.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key ===
              "Escape" &&
            input.value
          ) {
            input.value =
              "";

            searchQuery =
              "";

            applySearch(
              getCurrentLocalEntries(
                content
              )
            );
          }
        }
      );

      zone.append(
        label,
        input,
        status
      );

      if (localTitle) {
        localTitle
          .insertAdjacentElement(
            "afterend",
            zone
          );
      } else {
        localList
          .insertAdjacentElement(
            "beforebegin",
            zone
          );
      }
    }

    updateSearchStatus(
      zone,
      entries
    );
  }

  /**
   * Retourne les cartes actuelles.
   *
   * @param {HTMLElement} content
   * Contenu.
   *
   * @returns {Array<Object>}
   */
  function getCurrentLocalEntries(
    content
  ) {
    const survey =
      window.HeliaInventory
        .getSurveySnapshot();

    return Array.from(
      content.querySelectorAll(
        ".helia-summary-local-card"
      )
    ).map(
      (card) => ({
        card,

        local:
          survey.locals.find(
            (local) =>
              local.id ===
              card.dataset
                .heliaLocalId
          ) || {
            identifier:
              card.dataset
                .heliaSearchName ||
              "",
          },
      })
    );
  }

  /**
   * Applique la recherche.
   *
   * @param {Array<Object>} entries
   * Cartes.
   */
  function applySearch(
    entries
  ) {
    const query =
      normalizeText(
        searchQuery
      );

    let visibleCount = 0;

    entries.forEach(
      ({
        card,
        local,
      }) => {
        const name =
          normalizeText(
            local.identifier ||
            card.dataset
              .heliaSearchName
          );

        const isVisible =
          !query ||
          name.includes(
            query
          );

        if (isVisible) {
          card.style.removeProperty(
            "display"
          );

          visibleCount += 1;
        } else {
          card.style.setProperty(
            "display",
            "none",
            "important"
          );
        }
      }
    );

    const content =
      entries[0]
        ?.card
        ?.closest(
          ".helia-summary-content"
        );

    const zone =
      content?.querySelector(
        ":scope > .helia-summary-search-zone"
      );

    if (zone) {
      updateSearchStatus(
        zone,
        entries,
        visibleCount
      );
    }
  }

  /**
   * Met à jour le message de recherche.
   *
   * @param {HTMLElement} zone
   * Zone.
   *
   * @param {Array<Object>} entries
   * Cartes.
   *
   * @param {number|null} forcedVisibleCount
   * Nombre forcé.
   */
  function updateSearchStatus(
    zone,
    entries,
    forcedVisibleCount = null
  ) {
    const status =
      zone.querySelector(
        ".helia-summary-search-status"
      );

    if (!status) {
      return;
    }

    const visibleCount =
      forcedVisibleCount ??
      entries.filter(
        ({
          card,
        }) =>
          card.style.display !==
          "none"
      ).length;

    if (
      !normalizeText(
        searchQuery
      )
    ) {
      status.textContent =
        entries.length === 1
          ? "1 local"
          : `${entries.length} locaux`;

      return;
    }

    status.textContent =
      visibleCount === 0
        ? "Aucun local ne correspond à la recherche."
        : visibleCount === 1
          ? "1 résultat"
          : `${visibleCount} résultats`;
  }

  /**
   * Prépare les actions du relevé.
   *
   * @param {HTMLElement} content
   * Contenu.
   *
   * @param {HTMLElement|null} localList
   * Liste.
   */
  function prepareSurveyActions(
    content,
    localList
  ) {
    if (!localList) {
      return;
    }

    let actions =
      content.querySelector(
        ":scope > .helia-summary-survey-actions"
      );

    if (!actions) {
      actions =
        createElement(
          "section",
          {
            className:
              "helia-summary-survey-actions",
          }
        );

      const visibleActions =
        createElement(
          "div",
          {
            className:
              "helia-summary-visible-actions",
          }
        );

      const optionsToggle =
        createElement(
          "button",
          {
            className:
              "helia-summary-options-toggle",

            text:
              "Options du relevé",

            attributes: {
              type:
                "button",
            },
          }
        );

      optionsToggle.addEventListener(
        "click",
        () => {
          surveyOptionsOpen =
            !surveyOptionsOpen;

          applySurveyOptionsState(
            content
          );
        }
      );

      const optionsPanel =
        createElement(
          "div",
          {
            className:
              "helia-summary-options-panel",
          }
        );

      actions.append(
        visibleActions,
        optionsToggle,
        optionsPanel
      );

      localList.insertAdjacentElement(
        "afterend",
        actions
      );
    }

    const visibleActions =
      actions.querySelector(
        ".helia-summary-visible-actions"
      );

    const optionsPanel =
      actions.querySelector(
        ".helia-summary-options-panel"
      );

    if (
      !visibleActions ||
      !optionsPanel
    ) {
      return;
    }

    const externalButtons =
      Array.from(
        content.querySelectorAll(
          "button"
        )
      ).filter(
        (button) =>
          !button.closest(
            ".helia-summary-local-card"
          ) &&
          !button.closest(
            ".helia-summary-survey-actions"
          )
      );

    externalButtons.forEach(
      (button) => {
        const text =
          normalizeText(
            button.textContent
          );

        if (
          text.includes(
            "ajouter"
          ) &&
          text.includes(
            "local"
          )
        ) {
          button.classList.add(
            "helia-summary-action-primary"
          );

          visibleActions.append(
            button
          );

          return;
        }

        if (
          text.includes(
            "revenir a l'accueil"
          ) ||
          text.includes(
            "retour a l'accueil"
          )
        ) {
          button.classList.add(
            "helia-summary-action-secondary"
          );

          visibleActions.append(
            button
          );

          return;
        }

        if (
          text.includes(
            "exporter"
          ) ||
          text.includes(
            "partager"
          ) ||
          text.includes(
            "effacer tout le releve"
          )
        ) {
          button.classList.add(
            "helia-summary-option-button"
          );

          if (
            text.includes(
              "effacer tout le releve"
            )
          ) {
            button.classList.add(
              "helia-summary-danger-button"
            );
          }

          optionsPanel.append(
            button
          );
        }
      }
    );

    const nativeActionsTitle =
      content.querySelector(
        "#survey-actions-title"
      );

    const nativeActionsSection =
      nativeActionsTitle?.closest(
        "section"
      );

    if (nativeActionsSection) {
      nativeActionsSection
        .classList.add(
          "helia-summary-hidden-legacy"
        );
    }
  }

    /**
   * Applique l'état des options générales.
   *
   * @param {HTMLElement} content
   * Contenu.
   */
  function applySurveyOptionsState(
    content
  ) {
    const toggle =
      content.querySelector(
        ":scope > .helia-summary-survey-actions .helia-summary-options-toggle"
      );

    const panel =
      content.querySelector(
        ":scope > .helia-summary-survey-actions .helia-summary-options-panel"
      );

    if (
      !toggle ||
      !panel
    ) {
      return;
    }

    toggle.setAttribute(
      "aria-expanded",
      String(
        surveyOptionsOpen
      )
    );

    toggle.textContent =
      surveyOptionsOpen
        ? "Fermer les options du relevé"
        : "Options du relevé";

    panel.hidden =
      !surveyOptionsOpen;
  }

  /**
   * Masque les anciens contrôles devenus inutiles.
   *
   * @param {HTMLElement} content
   * Contenu.
   */
  function hideLegacyControls(
    content
  ) {
    Array.from(
      content.querySelectorAll(
        "input[type='search']"
      )
    ).forEach(
      (input) => {
        if (
          !input.classList
            .contains(
              "helia-summary-search-input"
            )
        ) {
          input.closest(
            "section, div"
          )?.classList.add(
            "helia-summary-hidden-legacy"
          );
        }
      }
    );

    Array.from(
      content.querySelectorAll(
        "button"
      )
    ).forEach(
      (button) => {
        if (
          button.classList
            .contains(
              "helia-summary-local-toggle"
            ) ||
          button.classList
            .contains(
              "helia-summary-options-toggle"
            ) ||
          button.classList
            .contains(
              "helia-summary-accordion-button"
            ) ||
          button.classList
            .contains(
              "helia-summary-rename-button"
            )
        ) {
          return;
        }

        const text =
          normalizeText(
            button.textContent
          );

        const legacyToggle =
          (
            text.includes(
              "afficher"
            ) &&
            text.includes(
              "objet"
            )
          ) ||
          (
            text.includes(
              "masquer"
            ) &&
            text.includes(
              "objet"
            )
          ) ||
          (
            text.includes(
              "option"
            ) &&
            text.includes(
              "local"
            )
          ) ||
          (
            text.includes(
              "option"
            ) &&
            text.includes(
              "releve"
            )
          );

        if (legacyToggle) {
          button.classList.add(
            "helia-summary-hidden-legacy"
          );
        }
      }
    );
  }

  /**
   * Trie les cartes alphabétiquement.
   *
   * @param {HTMLElement|null} localList
   * Liste.
   *
   * @param {Array<Object>} entries
   * Cartes.
   */
  function sortLocalCards(
    localList,
    entries
  ) {
    if (!localList) {
      return;
    }

    [...entries]
      .sort(
        (
          left,
          right
        ) =>
          String(
            left.local.identifier
          ).localeCompare(
            String(
              right.local.identifier
            ),
            "fr",
            {
              numeric:
                true,

              sensitivity:
                "base",
            }
          )
      )
      .forEach(
        ({
          card,
        }) => {
          localList.append(
            card
          );
        }
      );
  }

  /**
   * Applique l'état des cartes locales.
   *
   * @param {HTMLElement|null} content
   * Contenu.
   */
  function applyLocalStates(
    content
  ) {
    if (!content) {
      return;
    }

    Array.from(
      content.querySelectorAll(
        ".helia-summary-local-card"
      )
    ).forEach(
      (card) => {
        const isOpen =
          card.dataset
            .heliaLocalId ===
          openLocalId;

        const panel =
          card.querySelector(
            ":scope > .helia-summary-local-panel"
          );

        const toggle =
          card.querySelector(
            ":scope > .helia-summary-local-toggle"
          );

        if (panel) {
          panel.hidden =
            !isOpen;
        }

        if (toggle) {
          toggle.setAttribute(
            "aria-expanded",
            String(isOpen)
          );

          toggle.textContent =
            isOpen
              ? "Fermer les objets et options"
              : "Afficher les objets et options";
        }
      }
    );
  }

  /**
   * Normalise un texte.
   *
   * @param {unknown} value
   * Valeur.
   *
   * @returns {string}
   */
  function normalizeText(
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
        /\s+/g,
        " "
      )
      .trim();
  }

  /**
   * Formate une date ISO.
   *
   * @param {unknown} value
   * Date.
   *
   * @returns {string}
   */
  function formatDate(
    value
  ) {
    const text =
      String(
        value ?? ""
      ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        text
      )
    ) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] =
      text.split(
        "-"
      );

    return `${day}/${month}/${year}`;
  }

  /**
   * Modifie le texte d'un élément.
   *
   * @param {HTMLElement|null} element
   * Élément.
   *
   * @param {unknown} value
   * Valeur.
   */
  function setText(
    element,
    value
  ) {
    if (element) {
      element.textContent =
        String(
          value ?? ""
        );
    }
  }

  /**
   * Crée un élément HTML.
   *
   * @param {string} tagName
   * Balise.
   *
   * @param {Object} options
   * Options.
   *
   * @returns {HTMLElement}
   */
  function createElement(
    tagName,
    {
      className = "",
      text = null,
      attributes = {},
    } = {}
  ) {
    const element =
      document.createElement(
        tagName
      );

    if (className) {
      element.className =
        className;
    }

    if (text !== null) {
      element.textContent =
        text;
    }

    Object.entries(
      attributes
    ).forEach(
      ([name, value]) => {
        if (
          value !== null &&
          value !== undefined &&
          value !== false
        ) {
          element.setAttribute(
            name,
            value === true
              ? ""
              : String(value)
          );
        }
      }
    );

    return element;
  }

  /**
   * Injecte les styles.
   */
  function injectStyles() {
    document
      .getElementById(
        STYLE_ID
      )
      ?.remove();

    const style =
      document.createElement(
        "style"
      );

    style.id =
      STYLE_ID;

    style.textContent = `
      .helia-summary-page {
        --hs-bg: #001217;
        --hs-bg-soft: #03262d;
        --hs-card: rgb(4 48 56 / 82%);
        --hs-card-deep: rgb(1 27 33 / 94%);
        --hs-line: rgb(55 221 212 / 29%);
        --hs-accent: #24d3ca;
        --hs-accent-soft: #86eee8;
        --hs-text: #f4ffff;
        --hs-muted: #d8eaec;

        position: relative;
        isolation: isolate;

        width: 100%;
        max-width: none;

        min-height: 100vh;
        min-height: 100dvh;

        padding:
          max(
            14px,
            env(safe-area-inset-top)
          )
          max(
            13px,
            env(safe-area-inset-right)
          )
          max(
            34px,
            env(safe-area-inset-bottom)
          )
          max(
            13px,
            env(safe-area-inset-left)
          );

        overflow-x: hidden;

        color:
          var(--hs-text);

        background:
          radial-gradient(
            circle at 50% 0,
            rgb(0 190 182 / 15%),
            transparent 31rem
          ),
          linear-gradient(
            180deg,
            #011a20,
            var(--hs-bg)
          );
      }

      .helia-summary-page *,
      .helia-summary-page *::before,
      .helia-summary-page *::after {
        box-sizing:
          border-box;
      }

      .helia-summary-page [hidden],
      .helia-summary-hidden-legacy {
        display:
          none !important;
      }

      .helia-summary-background {
        position: absolute;
        z-index: -2;
        inset: 0;

        overflow: hidden;

        pointer-events: none;
      }

      .helia-summary-background svg {
        width: 100%;
        height: 100%;

        opacity: 0.28;
      }

            .helia-summary-page
        > .screen-header,
      .helia-summary-brand,
      .helia-summary-content {
        position: relative;
        z-index: 1;

        width:
          min(100%, 900px)
          !important;

        margin-inline:
          auto !important;
      }

      .helia-summary-page
        > .screen-header {
        min-height: 50px;

        margin-bottom:
          8px !important;
      }

      .helia-summary-page
        .screen-title {
        color:
          var(--hs-text)
          !important;

        font-size:
          0.92rem !important;

        letter-spacing:
          0.08em;

        text-transform:
          uppercase;
      }

      .helia-summary-page
        .button-icon {
        border-color:
          var(--hs-line)
          !important;

        color:
          var(--hs-accent-soft)
          !important;

        background:
          rgb(0 31 37 / 55%)
          !important;
      }

      .helia-summary-brand {
        display: grid;
        grid-template-columns:
          64px minmax(0, 1fr);

        align-items: center;
        gap: 13px;

        margin-bottom:
          16px !important;

        padding:
          4px 3px 10px;
      }

      .helia-summary-logo svg {
        display: block;

        width: 100%;
        height: auto;

        filter:
          drop-shadow(
            0 10px 20px
            rgb(0 205 196 / 18%)
          );
      }

      .helia-summary-suite {
        margin:
          0 0 2px;

        color:
          var(--hs-accent-soft);

        font-size:
          0.61rem;

        font-weight:
          760;

        letter-spacing:
          0.28em;
      }

      .helia-summary-name {
        margin: 0;

        color:
          var(--hs-text);

        font-size:
          clamp(
            1.65rem,
            7vw,
            2.5rem
          );

        font-weight:
          430;

        letter-spacing:
          0.08em;

        line-height: 1;
      }

      .helia-summary-subtitle {
        margin:
          7px 0 0;

        color:
          var(--hs-muted);

        font-size:
          0.78rem;

        line-height:
          1.4;
      }

      .helia-summary-content {
        display:
          flex !important;

        flex-direction:
          column;

        gap: 15px;

        min-height:
          0 !important;

        padding:
          0 !important;

        overflow:
          visible !important;

        border:
          0 !important;

        background:
          transparent !important;

        box-shadow:
          none !important;
      }

      .helia-summary-overview,
      .helia-summary-details-wrapper,
      .helia-summary-local-card,
      .helia-summary-survey-actions {
        border:
          1px solid
          var(--hs-line)
          !important;

        border-radius:
          20px !important;

        color:
          var(--hs-text);

        background:
          linear-gradient(
            145deg,
            var(--hs-card),
            var(--hs-card-deep)
          )
          !important;

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 5%),
          0 18px 40px
          rgb(0 0 0 / 24%)
          !important;

        backdrop-filter:
          blur(16px);

        -webkit-backdrop-filter:
          blur(16px);
      }

      .helia-summary-overview {
        padding: 21px;
      }

      .helia-summary-eyebrow,
      .helia-summary-locals-title,
      .helia-summary-panel-section
        > h3,
      .helia-summary-search-label {
        margin: 0;

        color:
          var(--hs-accent)
          !important;

        font-size:
          0.7rem !important;

        font-weight:
          760 !important;

        letter-spacing:
          0.12em;

        text-transform:
          uppercase;
      }

      .helia-summary-survey-name {
        margin:
          6px 0 0;

        color:
          var(--hs-text);

        font-size:
          clamp(
            1.32rem,
            6vw,
            2rem
          );

        font-weight:
          500;

        overflow-wrap:
          anywhere;
      }

      .helia-summary-meta {
        margin:
          9px 0 0;

        color:
          var(--hs-muted);

        font-size:
          0.88rem;

        font-weight:
          500;

        line-height:
          1.55;

        white-space:
          pre-line;
      }

      .helia-summary-stats {
        display: grid;
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );

        margin-top:
          17px;

        overflow: hidden;

        border:
          1px solid
          rgb(55 221 212 / 18%);

        border-radius:
          15px;

        background:
          rgb(0 17 22 / 30%);
      }

      .helia-summary-stats
        > div {
        display: flex;
        flex-direction:
          column;

        align-items:
          center;

        gap: 4px;

        min-height:
          86px;

        padding:
          13px 4px;
      }

      .helia-summary-stats
        > div
        + div {
        border-left:
          1px solid
          rgb(55 221 212 / 17%);
      }

      .helia-summary-stats
        strong {
        color:
          var(--hs-text);

        font-size:
          clamp(
            1.32rem,
            7vw,
            1.9rem
          );

        font-weight:
          480;
      }

      .helia-summary-stats
        span {
        color:
          var(--hs-accent-soft);

        font-size:
          0.68rem;
      }

      .helia-summary-details-wrapper,
      .helia-summary-survey-actions {
        padding: 14px;
      }

      .helia-summary-accordion-button,
      .helia-summary-options-toggle,
      .helia-summary-local-toggle {
        width: 100%;
        min-height: 50px;

        padding:
          12px 14px;

        border:
          1px solid
          rgb(50 226 216 / 42%);

        border-radius:
          13px;

        color:
          var(--hs-text);

        background:
          rgb(0 48 55 / 52%);

        cursor: pointer;

        font: inherit;

        font-size:
          0.86rem;

        font-weight:
          620;

        text-align: left;
      }

      .helia-summary-accordion-button:focus-visible,
      .helia-summary-options-toggle:focus-visible,
      .helia-summary-local-toggle:focus-visible,
      .helia-summary-search-input:focus-visible {
        outline:
          2px solid
          var(--hs-accent);

        outline-offset:
          3px;
      }

      /*
       * Harmonisation spécifique du bouton
       * « Options du relevé ».
       *
       * Cette règle remplace le correctif qui était
       * auparavant placé directement dans index.html.
       */
      .helia-summary-page
        .helia-summary-options-toggle {
        display:
          inline-flex !important;

        align-items:
          center !important;

        justify-content:
          center !important;

        width:
          100% !important;

        max-width:
          none !important;

        min-height:
          47px !important;

        padding:
          11px 15px !important;

        border-color:
          rgb(55 221 212 / 27%)
          !important;

        border-radius:
          12px !important;

        color:
          var(
            --hs-accent-soft,
            #86eee8
          )
          !important;

        background:
          rgb(0 25 31 / 45%)
          !important;

        font-family:
          inherit !important;

        font-size:
          0.81rem !important;

        font-weight:
          530 !important;

        letter-spacing:
          0 !important;

        line-height:
          1.35 !important;

        text-align:
          center !important;

        text-transform:
          none !important;

        white-space:
          normal !important;
      }

      .helia-summary-page
        .helia-summary-options-toggle:hover:not(
          :disabled
        ) {
        border-color:
          var(
            --hs-accent,
            #24d3ca
          )
          !important;

        color:
          var(
            --hs-text,
            #f4ffff
          )
          !important;

        background:
          rgb(3 58 65 / 64%)
          !important;
      }

      .helia-summary-page
        .helia-summary-options-toggle:focus-visible {
        outline:
          2px solid
          var(
            --hs-accent,
            #24d3ca
          )
          !important;

        outline-offset:
          3px !important;
      }

      @media (hover: none) {
        .helia-summary-page
          .helia-summary-options-toggle:hover:not(
            :disabled
          ) {
          border-color:
            rgb(55 221 212 / 27%)
            !important;

          color:
            var(
              --hs-accent-soft,
              #86eee8
            )
            !important;

          background:
            rgb(0 25 31 / 45%)
            !important;
        }
      }

      .helia-summary-details-panel,
      .helia-summary-options-panel,
      .helia-summary-local-panel {
        margin-top: 12px;
      }

      .helia-summary-details-card {
        display:
          flex !important;

        flex-direction:
          column;

        gap: 11px;

        padding:
          15px !important;

        border:
          1px solid
          rgb(55 221 212 / 18%)
          !important;

                  border-radius:
          14px !important;

        color:
          var(--hs-text)
          !important;

        background:
          rgb(0 19 24 / 42%)
          !important;
      }

      .helia-summary-details-card
        .field-label,
      .helia-summary-details-card
        .summary-item-label {
        color:
          var(--hs-accent-soft)
          !important;
      }

      .helia-summary-details-card
        .summary-item-details,
      .helia-summary-page
        .screen-introduction,
      .helia-summary-page
        .helper-text {
        color:
          var(--hs-muted)
          !important;

        opacity:
          1 !important;

        line-height:
          1.55;
      }

      .helia-summary-search-zone {
        display: flex;
        flex-direction:
          column;

        gap: 7px;
      }

      .helia-summary-search-input {
        width: 100%;
        min-height: 52px;

        padding:
          12px 14px;

        border:
          1px solid
          rgb(55 221 212 / 31%);

        border-radius:
          13px;

        color:
          var(--hs-text);

        background:
          rgb(0 22 27 / 67%);

        caret-color:
          var(--hs-accent);

        font: inherit;
      }

      .helia-summary-search-input::placeholder {
        color:
          rgb(215 237 239 / 70%);

        opacity: 1;
      }

      .helia-summary-search-input:focus {
        border-color:
          var(--hs-accent);

        outline: none;

        box-shadow:
          0 0 0 4px
          rgb(36 211 202 / 11%);
      }

      .helia-summary-search-status {
        margin: 0;

        color:
          var(--hs-muted);

        font-size:
          0.77rem;
      }

      .helia-summary-local-list {
        display:
          flex !important;

        flex-direction:
          column;

        gap: 13px;

        width: 100%;
      }

      .helia-summary-local-card {
        display: flex;
        flex-direction:
          column;

        align-items:
          stretch !important;

        gap:
          12px !important;

        width: 100%;

        padding:
          17px !important;
      }

      .helia-summary-local-card
        > .summary-item-information {
        display: flex;
        flex-direction:
          column;

        gap: 6px;
      }

      .helia-summary-local-card
        > .summary-item-information
        > .summary-item-label {
        color:
          var(--hs-accent)
          !important;

        font-size:
          1.12rem;

        font-weight:
          650;
      }

      .helia-summary-local-card
        > .summary-item-information
        > .summary-item-details {
        color:
          var(--hs-muted)
          !important;
      }

      .helia-summary-local-panel {
        display: flex;
        flex-direction:
          column;

        gap: 15px;
      }

      .helia-summary-panel-section {
        display: flex;
        flex-direction:
          column;

        gap: 10px;

        padding-top:
          14px;

        border-top:
          1px solid
          rgb(55 221 212 / 17%);
      }

      .helia-summary-object-list {
        display:
          flex !important;

        flex-direction:
          column;

        gap: 9px;
      }

      .helia-summary-object-card {
        display:
          grid !important;

        grid-template-columns:
          minmax(0, 1fr);

        gap:
          10px !important;

        padding:
          13px !important;

        border:
          1px solid
          rgb(55 221 212 / 18%)
          !important;

        border-radius:
          13px !important;

        color:
          var(--hs-text)
          !important;

        background:
          rgb(0 18 23 / 46%)
          !important;
      }

      .helia-summary-object-card
        .summary-item-label {
        color:
          var(--hs-text)
          !important;
      }

      .helia-summary-object-card
        .summary-item-details {
        color:
          var(--hs-muted)
          !important;
      }

      .helia-summary-object-card
        .summary-quantity-controls {
        display: grid;
        grid-template-columns:
          44px minmax(58px, 1fr) 44px;

        gap: 8px;

        width:
          min(100%, 250px);
      }

      .helia-summary-object-card
        .quantity-button,
      .helia-summary-object-card
        .summary-item-quantity {
        min-height: 44px;

        border-color:
          rgb(55 221 212 / 28%)
          !important;

        border-radius:
          10px !important;

        color:
          var(--hs-accent-soft)
          !important;

        background:
          rgb(0 29 35 / 60%)
          !important;
      }

      .helia-summary-empty-message {
        margin: 0;

        padding: 13px;

        border:
          1px dashed
          rgb(55 221 212 / 26%);

        border-radius:
          12px;

        color:
          var(--hs-muted)
          !important;

        background:
          rgb(0 18 23 / 35%);

        text-align: center;
      }

      .helia-summary-native-local-actions,
      .helia-summary-visible-actions,
      .helia-summary-options-panel {
        display: flex;
        flex-direction:
          column;

        gap: 9px;
      }

      .helia-summary-page
        .button,
      .helia-summary-action-primary,
      .helia-summary-action-secondary,
      .helia-summary-option-button {
        width:
          100% !important;

        max-width:
          none !important;

        min-height: 47px;

        border-radius:
          12px !important;
      }

      .helia-summary-page
        .button-primary,
      .helia-summary-action-primary {
        border-color:
          rgb(40 228 218 / 53%)
          !important;

        color:
          var(--hs-text)
          !important;

        background:
          linear-gradient(
            100deg,
            rgb(0 137 138 / 96%),
            rgb(0 86 98 / 96%)
          )
          !important;
      }

      .helia-summary-page
        .button-secondary,
      .helia-summary-action-secondary,
      .helia-summary-option-button {
        border-color:
          rgb(55 221 212 / 27%)
          !important;

        color:
          var(--hs-accent-soft)
          !important;

        background:
          rgb(0 25 31 / 45%)
          !important;
      }

      .helia-summary-danger-button {
        border-color:
          rgb(255 124 104 / 38%)
          !important;

        color:
          #ffb2a4 !important;

        background:
          rgb(255 124 104 / 7%)
          !important;
      }

      .helia-summary-rename-form {
        display: flex;
        flex-direction:
          column;

        gap: 10px;

        padding: 13px;

        border:
          1px solid
          rgb(55 221 212 / 20%);

        border-radius:
          12px;

        background:
          rgb(0 18 23 / 45%);
      }

      .helia-summary-rename-form
        .text-input {
        color:
          var(--hs-text)
          !important;

        background:
          rgb(0 28 34 / 65%)
          !important;
      }

      .helia-summary-form-actions {
        display: grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );

        gap: 8px;
      }

      .helia-summary-form-error {
        margin: 0;

        color:
          #ffb2a4;

        font-size:
          0.84rem;
      }

      .helia-summary-survey-actions {
        display: flex;
        flex-direction:
          column;

        gap: 10px;
      }

      .helia-summary-options-panel {
        padding-top:
          12px;

        border-top:
          1px solid
          rgb(55 221 212 / 17%);
      }

      @media (min-width: 700px) {
        .helia-summary-brand {
          grid-template-columns:
            78px minmax(0, 1fr);
        }

        .helia-summary-object-card {
          grid-template-columns:
            minmax(0, 1fr)
            auto
            auto
            !important;

          align-items:
            center !important;
        }

        .helia-summary-native-local-actions,
        .helia-summary-visible-actions,
        .helia-summary-options-panel {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }
      }
    `;

    document.head.append(
      style
    );
  }

  /**
   * Force une actualisation.
   */
  function refresh() {
    enhanceCurrentScreen();
  }

  /**
   * Débranche le module.
   */
  function destroy() {
    observer?.disconnect();

    observer = null;
    appElement = null;

    scheduled = false;
    enhancing = false;

    openLocalId = null;

    surveyOptionsOpen =
      false;

    surveyDetailsOpen =
      false;

    searchQuery = "";
  }

  /**
   * Démarrage automatique.
   */
  function start() {
    try {
      initialize();
    } catch (error) {
      console.error(
        "Le design du récapitulatif H-ELIA n'a pas pu démarrer :",
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
    refresh,
    destroy,
  });
})();