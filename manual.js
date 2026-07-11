"use strict";

/**
 * Ajout manuel d'objets dans ATLAS H-ELIA.
 *
 * Ce module reste indépendant de ui.js :
 * - il détecte l'écran de scan ;
 * - il ajoute une carte de saisie manuelle ;
 * - il enregistre les objets via HeliaInventory ;
 * - il met à jour le compteur visible du local.
 */
window.HeliaManualEntry = (() => {
  const ELEMENT_IDS = Object.freeze({
    app: "app",

    card:
      "helia-manual-entry-card",

    nameInput:
      "helia-manual-object-name",

    quantityInput:
      "helia-manual-object-quantity",

    feedback:
      "helia-manual-entry-feedback",
  });

  const MAXIMUM_QUANTITY = 999;

  let appElement = null;
  let observer = null;
  let renderScheduled = false;

  let formIsOpen = false;
  let currentQuantity = 1;

  let feedbackMessage = "";
  let feedbackIsError = false;

  /**
   * Initialise le module.
   *
   * @param {string} appElementId
   * Identifiant du conteneur principal.
   */
  function initialize(
    appElementId = ELEMENT_IDS.app
  ) {
    if (observer) {
      return;
    }

    validateDependencies();

    appElement =
      document.getElementById(
        appElementId
      );

    if (!appElement) {
      console.warn(
        `Le module d'ajout manuel attend le conteneur #${appElementId}.`
      );

      return;
    }

    observer =
      new MutationObserver(
        scheduleEnhancement
      );

    observer.observe(
      appElement,
      {
        childList: true,
        subtree: true,
      }
    );

    enhanceCurrentScreen();
  }

  /**
   * Vérifie les dépendances requises.
   */
  function validateDependencies() {
    if (!window.HeliaInventory) {
      throw new Error(
        "HeliaInventory doit être chargé avant manual.js."
      );
    }
  }

  /**
   * Programme une seule mise à jour
   * après une modification du DOM.
   */
  function scheduleEnhancement() {
    if (renderScheduled) {
      return;
    }

    renderScheduled = true;

    requestAnimationFrame(
      () => {
        renderScheduled = false;

        enhanceCurrentScreen();
      }
    );
  }

  /**
   * Ajoute la carte uniquement
   * sur l'écran de scan.
   */
  function enhanceCurrentScreen() {
    if (!appElement) {
      return;
    }

    const scanContent =
      appElement.querySelector(
        ".scan-content"
      );

    const counterElement =
      document.getElementById(
        "scan-object-counter"
      );

    /*
     * L'écran actuel n'est pas
     * l'écran de scan.
     */
    if (
      !scanContent ||
      !counterElement
    ) {
      formIsOpen = false;
      currentQuantity = 1;

      feedbackMessage = "";
      feedbackIsError = false;

      return;
    }

    /*
     * La carte est déjà présente.
     */
    if (
      document.getElementById(
        ELEMENT_IDS.card
      )
    ) {
      return;
    }

    const card =
      createManualEntryCard();

    counterElement
      .insertAdjacentElement(
        "afterend",
        card
      );
  }

  /**
   * Crée la carte principale.
   *
   * @returns {HTMLElement}
   */
  function createManualEntryCard() {
    const card =
      createElement(
        "section",
        {
          id:
            ELEMENT_IDS.card,

          className:
            "prediction-card",

          attributes: {
            "aria-labelledby":
              "helia-manual-entry-title",
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
            "helia-manual-entry-title",

          className:
            "prediction-title",

          textContent:
            "Ajout manuel",
        }
      );

    const status =
      createElement(
        "span",
        {
          className:
            "status-pill status-pill-ready",

          textContent:
            "Disponible",
        }
      );

    header.append(
      title,
      status
    );

    card.append(
      header
    );

    if (feedbackMessage) {
      card.append(
        createFeedbackElement()
      );
    }

    if (formIsOpen) {
      card.append(
        createManualEntryForm()
      );
    } else {
      card.append(
        createClosedActions()
      );
    }

    return card;
  }

  /**
   * Crée les actions lorsque
   * le formulaire est fermé.
   *
   * @returns {HTMLElement}
   */
  function createClosedActions() {
    const container =
      createElement(
        "div",
        {
          className:
            "prediction-actions",
        }
      );

    const explanation =
      createElement(
        "p",
        {
          className:
            "screen-introduction",

          textContent:
            "Ajoutez un objet qui n'est pas reconnu par l'intelligence artificielle.",
        }
      );

    const openButton =
      createButton({
        label:
          feedbackMessage
            ? "Ajouter un autre objet"
            : "Ajouter un objet manuellement",

        className:
          "button button-secondary",

        onClick:
          openForm,
      });

    container.append(
      explanation,
      openButton
    );

    return container;
  }

  /**
   * Ouvre le formulaire.
   */
  function openForm() {
    formIsOpen = true;
    currentQuantity = 1;

    feedbackMessage = "";
    feedbackIsError = false;

    renderCard();

    requestAnimationFrame(
      () => {
        document
          .getElementById(
            ELEMENT_IDS.nameInput
          )
          ?.focus({
            preventScroll: true,
          });
      }
    );
  }

  /**
   * Ferme le formulaire.
   */
  function closeForm() {
    formIsOpen = false;
    currentQuantity = 1;

    feedbackMessage = "";
    feedbackIsError = false;

    renderCard();
  }

  /**
   * Crée le formulaire complet.
   *
   * @returns {HTMLElement}
   */
  function createManualEntryForm() {
    const form =
      createElement(
        "form",
        {
          className:
            "prediction-actions",

          attributes: {
            novalidate: "",
          },
        }
      );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        addManualObject();
      }
    );

    const nameGroup =
      createElement(
        "div",
        {
          className:
            "field-group",
        }
      );

    const nameLabel =
      createElement(
        "label",
        {
          className:
            "field-label",

          textContent:
            "Nom de l'objet *",

          attributes: {
            for:
              ELEMENT_IDS
                .nameInput,
          },
        }
      );

    const nameInput =
      createElement(
        "input",
        {
          id:
            ELEMENT_IDS
              .nameInput,

          className:
            "text-input",

          attributes: {
            type: "text",

            maxlength:
              "160",

            autocomplete:
              "off",

            enterkeyhint:
              "done",

            required: "",

            placeholder:
              "Ex. chaise, tensiomètre…",
          },
        }
      );

    nameInput.addEventListener(
      "input",
      () => {
        clearFieldError(
          nameInput
        );
      }
    );

    nameGroup.append(
      nameLabel,
      nameInput
    );

    const quantityTitle =
      createElement(
        "strong",
        {
          className:
            "quantity-title",

          textContent:
            "Quantité",
        }
      );

    const quantityControls =
      createElement(
        "div",
        {
          className:
            "quantity-controls",
        }
      );

    const quantityInput =
      createElement(
        "input",
        {
          id:
            ELEMENT_IDS
              .quantityInput,

          className:
            "text-input quantity-input",

          attributes: {
            type: "number",
            min: "1",

            max:
              String(
                MAXIMUM_QUANTITY
              ),

            inputmode:
              "numeric",

            "aria-label":
              "Quantité de l'objet manuel",
          },
        }
      );

    quantityInput.value =
      String(
        currentQuantity
      );

    quantityInput.addEventListener(
      "change",
      () => {
        currentQuantity =
          normalizeQuantity(
            quantityInput.value
          );

        quantityInput.value =
          String(
            currentQuantity
          );
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
          currentQuantity =
            Math.max(
              1,
              currentQuantity - 1
            );

          quantityInput.value =
            String(
              currentQuantity
            );
        },
      });

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
          currentQuantity =
            Math.min(
              MAXIMUM_QUANTITY,
              currentQuantity + 1
            );

          quantityInput.value =
            String(
              currentQuantity
            );
        },
      });

    quantityControls.append(
      minusButton,
      quantityInput,
      plusButton
    );

    const addButton =
      createButton({
        label:
          "Ajouter l'objet",

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

        onClick:
          closeForm,
      });

    form.append(
      nameGroup,
      quantityTitle,
      quantityControls,
      addButton,
      cancelButton
    );

    return form;
  }

  /**
   * Enregistre l'objet manuel
   * dans le local actif.
   */
  function addManualObject() {
    const nameInput =
      document.getElementById(
        ELEMENT_IDS.nameInput
      );

    const quantityInput =
      document.getElementById(
        ELEMENT_IDS
          .quantityInput
      );

    if (!nameInput) {
      return;
    }

    clearFieldError(
      nameInput
    );

    const label =
      normalizeObjectLabel(
        nameInput.value
      );

    if (!label) {
      displayFieldError(
        nameInput,
        "Veuillez saisir le nom de l'objet."
      );

      nameInput.focus();

      return;
    }

    const quantity =
      normalizeQuantity(
        quantityInput?.value ??
          currentQuantity
      );

    try {
      const addedItem =
        window.HeliaInventory
          .addItem({
            label,
            quantity,

            confidence:
              null,

            source:
              "manual",
          });

      formIsOpen = false;
      currentQuantity = 1;

      feedbackIsError = false;

      feedbackMessage =
        createSuccessMessage(
          label,
          quantity,
          addedItem
        );

      updateVisibleCounter();

      renderCard();
    } catch (error) {
      console.error(
        "Impossible d'ajouter l'objet manuellement :",
        error
      );

      feedbackIsError = true;

      feedbackMessage =
        error?.message ||
        "L'objet n'a pas pu être ajouté.";

      renderCard();
    }
  }

  /**
   * Crée le message de confirmation.
   *
   * @param {string} label Nom.
   * @param {number} quantity Quantité.
   * @param {Object} addedItem Résultat.
   * @returns {string}
   */
  function createSuccessMessage(
    label,
    quantity,
    addedItem
  ) {
    const quantityMessage =
      quantity === 1
        ? `« ${label} » a été ajouté.`
        : `${quantity} × « ${label} » ont été ajoutés.`;

    if (addedItem?.wasMerged) {
      return (
        quantityMessage +
        " La quantité de la ligne existante a été mise à jour."
      );
    }

    return quantityMessage;
  }

  /**
   * Met à jour le compteur
   * déjà présent dans ui.js.
   */
  function updateVisibleCounter() {
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
   * Remplace uniquement
   * la carte manuelle.
   */
  function renderCard() {
    const currentCard =
      document.getElementById(
        ELEMENT_IDS.card
      );

    if (!currentCard) {
      enhanceCurrentScreen();

      return;
    }

    currentCard.replaceWith(
      createManualEntryCard()
    );
  }

  /**
   * Crée un message de retour accessible.
   *
   * @returns {HTMLElement}
   */
  function createFeedbackElement() {
    return createElement(
      "div",
      {
        id:
          ELEMENT_IDS.feedback,

        className:
          feedbackIsError
            ? "inline-alert"
            : "prediction-main-result",

        textContent:
          feedbackMessage,

        attributes: {
          role:
            feedbackIsError
              ? "alert"
              : "status",

          "aria-live":
            "polite",
        },
      }
    );
  }

  /**
   * Normalise le nom d'un objet.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function normalizeObjectLabel(
    value
  ) {
    return String(
      value ?? ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        160
      );
  }

  /**
   * Normalise une quantité
   * entre 1 et 999.
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
      MAXIMUM_QUANTITY
    );
  }

  /**
   * Formate le compteur du local.
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
   * Affiche une erreur sous un champ.
   *
   * @param {HTMLElement} input Champ.
   * @param {string} message Message.
   */
  function displayFieldError(
    input,
    message
  ) {
    clearFieldError(
      input
    );

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
          id:
            errorId,

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
   * Efface l'erreur d'un champ.
   *
   * @param {HTMLElement} input Champ.
   */
  function clearFieldError(
    input
  ) {
    if (!input?.id) {
      return;
    }

    document
      .getElementById(
        `${input.id}-error`
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
   * Crée un bouton.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLButtonElement}
   */
  function createButton({
    label,
    className,
    onClick = null,
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
        String(
          textContent
        );
    }

    Object.entries(
      attributes
    ).forEach(
      ([name, value]) => {
        element.setAttribute(
          name,
          String(value)
        );
      }
    );

    return element;
  }

  /**
   * Débranche le module.
   */
  function destroy() {
    observer?.disconnect();

    observer = null;
    appElement = null;

    renderScheduled = false;
    formIsOpen = false;

    currentQuantity = 1;

    feedbackMessage = "";
    feedbackIsError = false;
  }

  /**
   * Démarrage automatique
   * après création du DOM.
   */
  function startAutomatically() {
    try {
      initialize();
    } catch (error) {
      console.error(
        "Le module d'ajout manuel n'a pas pu démarrer :",
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
    queueMicrotask(
      startAutomatically
    );
  }

  return Object.freeze({
    initialize,
    destroy,
  });
})();