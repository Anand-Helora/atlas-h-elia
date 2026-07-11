"use strict";

/**
 * Écran d'identification immersif d'ATLAS H-ELIA.
 *
 * Ce module :
 * - transforme l'écran existant sans modifier ui.js ;
 * - conserve les champs, les validations et l'envoi du formulaire ;
 * - applique le même univers graphique sombre que l'accueil ;
 * - affiche les informations essentielles en premier ;
 * - range les champs facultatifs dans un panneau repliable ;
 * - fonctionne aussi lors de l'ajout d'un local à un relevé existant.
 */
window.HeliaIdentification = (() => {
  const APP_ELEMENT_ID =
    "app";

  const STYLE_ELEMENT_ID =
    "helia-identification-styles";

  const ENHANCED_ATTRIBUTE =
    "data-helia-identification-enhanced";

  const BACKGROUND_ATTRIBUTE =
    "data-helia-identification-background";

  const INTRO_ATTRIBUTE =
    "data-helia-identification-intro";

  const STEP_HEADER_ATTRIBUTE =
    "data-helia-identification-step-header";

  const PRIMARY_FIELDS_ATTRIBUTE =
    "data-helia-identification-primary-fields";

  const OPTIONAL_TOGGLE_ATTRIBUTE =
    "data-helia-identification-optional-toggle";

  const OPTIONAL_PANEL_ATTRIBUTE =
    "data-helia-identification-optional-panel";

  const LOCAL_EXPLANATION_ATTRIBUTE =
    "data-helia-identification-local-explanation";

  const STORAGE_NOTE_ATTRIBUTE =
    "data-helia-identification-storage-note";

  const OPTIONAL_FIELD_IDS =
    Object.freeze([
      "survey-reference",
      "survey-site",
      "survey-building",
      "survey-level",
      "survey-unit",
      "survey-operator",
      "survey-notes",
    ]);

  const ICONS =
    Object.freeze({
      back: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m14.5 5-7 7 7 7"></path>
        </svg>
      `,

      chevron: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m9 5 7 7-7 7"></path>
        </svg>
      `,

      expand: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m6 9 6 6 6-6"></path>
        </svg>
      `,

      collapse: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m6 15 6-6 6 6"></path>
        </svg>
      `,

      check: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m5 12.5 4.2 4.2L19 7"></path>
        </svg>
      `,
    });

  let appElement =
    null;

  let observer =
    null;

  let enhancementScheduled =
    false;

  let optionalDetailsAreExpanded =
    false;

  let currentPage =
    null;

  /**
   * Initialise le module.
   *
   * @param {string} appElementId
   * Conteneur principal.
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
        `L'écran d'identification attend le conteneur #${appElementId}.`
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
   * Vérifie les dépendances minimales.
   */
  function validateDependencies() {
    if (!window.HeliaInventory) {
      throw new Error(
        "HeliaInventory doit être chargé avant identification.js."
      );
    }
  }

  /**
   * Ajoute les styles du nouvel écran.
   */
  function injectStyles() {
    if (
      document.getElementById(
        STYLE_ELEMENT_ID
      )
    ) {
      return;
    }

    const styleElement =
      document.createElement(
        "style"
      );

    styleElement.id =
      STYLE_ELEMENT_ID;

    styleElement.textContent = `
      .screen.helia-identification-page {
        --helia-id-bg: #01161b;
        --helia-id-bg-deep: #000d11;
        --helia-id-panel: rgb(4 48 56 / 88%);
        --helia-id-panel-soft: rgb(6 67 74 / 54%);
        --helia-id-border: rgb(47 211 203 / 32%);
        --helia-id-border-strong: rgb(43 225 216 / 58%);
        --helia-id-accent: #18d2ca;
        --helia-id-accent-soft: #7de9e4;
        --helia-id-text: #f3ffff;
        --helia-id-muted: #93b9bd;
        --helia-id-error: #ff9a72;

        position: relative;
        isolation: isolate;

        display: flex;
        flex-direction: column;
        align-items: stretch;

        width: 100%;
        max-width: none;
        min-height: 100vh;
        min-height: 100dvh;

        margin: 0;

        padding:
          max(16px, env(safe-area-inset-top))
          max(14px, env(safe-area-inset-right))
          max(32px, env(safe-area-inset-bottom))
          max(14px, env(safe-area-inset-left));

        overflow: hidden;

        color: var(--helia-id-text);

        background:
          radial-gradient(
            circle at 50% 4%,
            rgb(0 178 171 / 16%),
            transparent 30rem
          ),
          radial-gradient(
            circle at 8% 48%,
            rgb(0 158 153 / 7%),
            transparent 26rem
          ),
          linear-gradient(
            180deg,
            var(--helia-id-bg) 0%,
            var(--helia-id-bg-deep) 100%
          );
      }

      .helia-identification-page *,
      .helia-identification-page *::before,
      .helia-identification-page *::after {
        box-sizing: border-box;
      }

      .helia-identification-background {
        position: absolute;
        z-index: -2;
        inset: 0;

        width: 100%;
        height: 100%;

        overflow: hidden;

        pointer-events: none;
      }

      .helia-identification-background svg {
        display: block;

        width: 100%;
        height: 100%;

        opacity: 0.26;
      }

      .helia-identification-background::after {
        position: absolute;
        inset: 0;

        background:
          linear-gradient(
            180deg,
            transparent 0%,
            transparent 45%,
            rgb(0 13 17 / 58%) 78%,
            var(--helia-id-bg-deep) 100%
          );

        content: "";
      }

      .helia-identification-glow {
        position: absolute;
        z-index: -1;
        top: -120px;
        left: 50%;

        width: min(92vw, 780px);
        height: 620px;

        border-radius: 50%;

        background:
          radial-gradient(
            circle,
            rgb(0 206 197 / 12%) 0%,
            transparent 69%
          );

        pointer-events: none;

        transform: translateX(-50%);
      }

      /* ===================================================
         EN-TÊTE
         =================================================== */

      .helia-identification-page > .screen-header {
        position: relative;
        z-index: 2;

        display: grid;
        grid-template-columns:
          auto minmax(0, 1fr) auto;

        align-items: center;

        width: min(100%, 820px);
        min-height: 54px;

        margin: 0 auto 12px;
      }

      .helia-identification-page
        .screen-header
        .button-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;

        grid-column: 1;

        width: auto;
        min-width: 0;
        min-height: 44px;

        padding: 8px 11px;

        border:
          1px solid
          rgb(70 211 205 / 26%);

        border-radius: 12px;

        color:
          var(--helia-id-accent-soft);

        background:
          rgb(1 31 37 / 44%);

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 3%);
      }

      .helia-identification-page
        .screen-header
        .button-icon svg {
        width: 19px;
        height: 19px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.9;
      }

      .helia-identification-page
        .screen-header
        .button-icon:hover:not(:disabled) {
        border-color:
          var(--helia-id-border-strong);

        background:
          rgb(5 59 66 / 62%);
      }

      .helia-identification-page
        .screen-title {
        grid-column: 2;

        margin: 0;
        padding: 0 10px;

        color:
          rgb(231 255 255 / 78%);

        font-size:
          clamp(
            0.86rem,
            3.5vw,
            1rem
          );

        font-weight: 590;
        letter-spacing: 0.08em;
        line-height: 1.3;
        text-align: center;
        text-transform: uppercase;
      }

      /* ===================================================
         IDENTITÉ COMPACTE
         =================================================== */

      .helia-identification-intro {
        position: relative;
        z-index: 1;

        display: grid;
        grid-template-columns:
          auto minmax(0, 1fr);

        align-items: center;
        gap: 16px;

        width: min(100%, 820px);

        margin: 0 auto 18px;
        padding: 8px 2px 12px;
      }

      .helia-identification-logo {
        width:
          clamp(
            66px,
            18vw,
            88px
          );

        filter:
          drop-shadow(
            0 10px 22px
            rgb(0 207 197 / 18%)
          );
      }

      .helia-identification-logo svg {
        display: block;

        width: 100%;
        height: auto;
      }

      .helia-identification-brand-copy {
        min-width: 0;
      }

      .helia-identification-suite {
        margin: 0 0 3px;

        color:
          var(--helia-id-accent-soft);

        font-size: 0.63rem;
        font-weight: 720;
        letter-spacing: 0.3em;
        line-height: 1.2;
        text-transform: uppercase;

        opacity: 0.72;
      }

      .helia-identification-brand-name {
        margin: 0;

        color:
          var(--helia-id-text);

        font-size:
          clamp(
            1.75rem,
            8vw,
            2.7rem
          );

        font-weight: 410;
        letter-spacing: 0.08em;
        line-height: 1;
      }

      .helia-identification-brand-description {
        margin: 8px 0 0;

        color:
          var(--helia-id-accent-soft);

        font-size:
          clamp(
            0.76rem,
            3vw,
            0.93rem
          );

        font-weight: 410;
        line-height: 1.4;

        opacity: 0.83;
      }

      /* ===================================================
         CARTE ET FORMULAIRE
         =================================================== */

      .helia-identification-page
        > .content-card {
        position: relative;
        z-index: 1;

        display: block;

        width: min(100%, 820px);
        min-height: 0;

        margin: 0 auto;

        padding:
          clamp(
            19px,
            5vw,
            30px
          );

        overflow: hidden;

        border:
          1px solid
          var(--helia-id-border);

        border-radius: 25px;

        color:
          var(--helia-id-text);

        background:
          linear-gradient(
            145deg,
            rgb(8 72 80 / 74%) 0%,
            rgb(2 34 40 / 91%) 100%
          );

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 5%),
          0 24px 60px
          rgb(0 0 0 / 30%);

        backdrop-filter:
          blur(18px);

        -webkit-backdrop-filter:
          blur(18px);
      }

      .helia-identification-page
        > .content-card::before {
        position: absolute;
        top: -170px;
        right: -170px;

        width: 360px;
        height: 360px;

        border:
          54px solid
          rgb(40 215 207 / 4%);

        border-radius: 50%;

        content: "";
        pointer-events: none;
      }

      .helia-identification-page
        > .content-card
        > form {
        position: relative;
        z-index: 1;

        display: flex;
        flex-direction: column;
        gap: 22px;

        width: 100%;
        min-width: 0;
      }

      .helia-identification-page
        > .content-card
        > form
        > .screen-introduction {
        display: none !important;
      }

      .helia-identification-step-header {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;

        width: 100%;
        min-width: 0;

        padding-bottom: 19px;

        border-bottom:
          1px solid
          rgb(83 218 212 / 16%);
      }

      .helia-identification-step-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        min-height: 27px;

        padding: 5px 10px;

        border:
          1px solid
          rgb(61 226 218 / 38%);

        border-radius: 999px;

        color:
          var(--helia-id-accent-soft);

        background:
          rgb(0 158 153 / 9%);

        font-size: 0.64rem;
        font-weight: 760;
        letter-spacing: 0.14em;
        line-height: 1;
        text-transform: uppercase;
      }

      .helia-identification-step-title {
        margin: 0;

        color:
          var(--helia-id-text);

        font-size:
          clamp(
            1.45rem,
            6vw,
            2.05rem
          );

        font-weight: 490;
        line-height: 1.2;
      }

      .helia-identification-step-description {
        max-width: 650px;

        margin: 0;

        color:
          var(--helia-id-muted);

        font-size: 0.9rem;
        font-weight: 410;
        line-height: 1.55;
      }

      .helia-identification-current-survey {
        display: inline-flex;
        align-items: center;
        gap: 8px;

        max-width: 100%;

        margin-top: 3px;
        padding: 8px 11px;

        border:
          1px solid
          rgb(57 213 205 / 24%);

        border-radius: 11px;

        color:
          var(--helia-id-accent-soft);

        background:
          rgb(0 158 153 / 7%);

        font-size: 0.8rem;
        line-height: 1.4;

        overflow-wrap: anywhere;
      }

      /* ===================================================
         SECTIONS
         =================================================== */

      .helia-identification-survey-section,
      .helia-identification-local-section {
        display: flex;
        flex-direction: column;
        gap: 15px;

        width: 100%;
        min-width: 0;
      }

      .helia-identification-survey-section
        > .summary-title,
      .helia-identification-survey-section
        > .screen-introduction {
        display: none !important;
      }

      .helia-identification-local-section {
        padding-top: 20px;

        border-top:
          1px solid
          rgb(83 218 212 / 16%);
      }

      .helia-identification-local-section
        > .summary-title {
        margin: 0;

        color:
          var(--helia-id-text);

        font-size:
          clamp(
            1.05rem,
            4.4vw,
            1.28rem
          );

        font-weight: 520;
        line-height: 1.3;
        text-align: left;
      }

      .helia-identification-local-explanation {
        margin: -7px 0 1px;

        color:
          var(--helia-id-muted);

        font-size: 0.82rem;
        line-height: 1.5;
      }

      .helia-identification-primary-fields,
      .helia-identification-optional-panel {
        display: grid;
        grid-template-columns: 1fr;
        gap: 15px;

        width: 100%;
        min-width: 0;
      }

      .helia-identification-optional-panel {
        padding: 16px;

        border:
          1px solid
          rgb(62 209 203 / 20%);

        border-radius: 17px;

        background:
          rgb(0 19 24 / 22%);
      }

      .helia-identification-field {
        display: flex;
        flex-direction: column;
        gap: 8px;

        width: 100%;
        min-width: 0;
      }

      .helia-identification-page
        .field-label {
        color:
          rgb(231 255 255 / 86%);

        font-size: 0.84rem;
        font-weight: 570;
        line-height: 1.35;
      }

      .helia-identification-page
        .text-input,
      .helia-identification-page
        textarea.text-input {
        width: 100%;
        min-width: 0;
        min-height: 56px;

        padding: 13px 15px;

        border:
          1px solid
          rgb(74 213 207 / 31%);

        border-radius: 14px;

        color:
          var(--helia-id-text);

        background:
          rgb(0 22 27 / 53%);

        caret-color:
          var(--helia-id-accent);

        font-family: inherit;
        font-size: 0.97rem;
        font-weight: 410;
        line-height: 1.45;

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 3%);

        transition:
          border-color 150ms ease,
          background-color 150ms ease,
          box-shadow 150ms ease;
      }

      .helia-identification-page
        textarea.text-input {
        min-height: 126px;

        resize: vertical;
      }

      .helia-identification-page
        .text-input::placeholder,
      .helia-identification-page
        textarea.text-input::placeholder {
        color:
          rgb(146 190 194 / 58%);

        opacity: 1;
      }

      .helia-identification-page
        .text-input:focus,
      .helia-identification-page
        textarea.text-input:focus {
        border-color:
          var(--helia-id-accent);

        background:
          rgb(1 32 38 / 72%);

        box-shadow:
          0 0 0 4px
          rgb(24 210 202 / 11%),
          inset 0 1px 0
          rgb(255 255 255 / 4%);
      }

      .helia-identification-page
        input[type="date"] {
        color-scheme: dark;
      }

      .helia-identification-page
        .text-input-error {
        border-color:
          var(--helia-id-error)
          !important;

        box-shadow:
          0 0 0 4px
          rgb(255 154 114 / 10%);
      }

      .helia-identification-page
        .field-error {
        margin: 2px 0 0;

        color: #ffc2a9;

        font-size: 0.82rem;
        font-weight: 560;
        line-height: 1.4;
      }

      /* ===================================================
         INFORMATIONS FACULTATIVES
         =================================================== */

      .helia-identification-optional-toggle {
        display: grid !important;
        grid-template-columns:
          minmax(0, 1fr) auto;

        align-items: center;
        gap: 12px;

        width: 100% !important;
        max-width: none !important;
        min-height: 50px;

        padding:
          11px 14px !important;

        border:
          1px solid
          rgb(57 213 205 / 25%)
          !important;

        border-radius:
          14px !important;

        color:
          var(--helia-id-accent-soft)
          !important;

        background:
          rgb(0 26 31 / 36%)
          !important;

        text-align: left !important;
      }

      .helia-identification-optional-toggle:hover:not(:disabled) {
        border-color:
          var(--helia-id-border-strong)
          !important;

        background:
          rgb(4 52 59 / 52%)
          !important;
      }

      .helia-identification-toggle-copy {
        display: flex;
        flex-direction: column;
        gap: 3px;

        min-width: 0;
      }

      .helia-identification-toggle-title {
        color:
          var(--helia-id-text);

        font-size: 0.9rem;
        font-weight: 540;
        line-height: 1.3;
      }

      .helia-identification-toggle-description {
        color:
          var(--helia-id-muted);

        font-size: 0.73rem;
        font-weight: 400;
        line-height: 1.35;
      }

      .helia-identification-toggle-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        color:
          var(--helia-id-accent);
      }

      .helia-identification-toggle-icon svg {
        width: 21px;
        height: 21px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
      }

      /* ===================================================
         LOCAL ET QR
         =================================================== */

      .helia-identification-local-section
        > .button-secondary,
      .helia-identification-local-section
        > .helper-text {
        display: none !important;
      }

      /* ===================================================
         ACTION PRINCIPALE
         =================================================== */

      .helia-identification-submit {
        display: grid !important;
        grid-template-columns:
          minmax(0, 1fr) auto;

        align-items: center;
        gap: 14px;

        width: 100% !important;
        max-width: none !important;
        min-height: 62px;

        margin-top: 2px;

        padding:
          14px 17px !important;

        border:
          1px solid
          rgb(43 225 216 / 59%)
          !important;

        border-radius:
          16px !important;

        color:
          var(--helia-id-text)
          !important;

        background:
          linear-gradient(
            100deg,
            rgb(0 137 138 / 96%) 0%,
            rgb(0 91 103 / 95%) 100%
          ) !important;

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 8%),
          0 16px 34px
          rgb(0 123 124 / 18%)
          !important;

        font-size:
          1rem !important;

        font-weight:
          560 !important;

        text-align:
          left !important;
      }

      .helia-identification-submit:hover:not(:disabled) {
        border-color:
          var(--helia-id-accent)
          !important;

        background:
          linear-gradient(
            100deg,
            rgb(0 153 151 / 98%) 0%,
            rgb(0 108 117 / 98%) 100%
          ) !important;

        transform:
          translateY(-1px);
      }

      .helia-identification-submit:active:not(:disabled) {
        transform:
          translateY(0);
      }

      .helia-identification-submit-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        color:
          var(--helia-id-accent-soft);
      }

      .helia-identification-submit-icon svg {
        width: 24px;
        height: 24px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.9;
      }

      .helia-identification-submit.button-loading {
        display:
          inline-flex !important;

        justify-content: center;
      }

      /* ===================================================
         NOTE DE SAUVEGARDE
         =================================================== */

      .helia-identification-storage-note {
        position: relative;
        z-index: 1;

        display: flex;
        align-items: flex-start;
        gap: 9px;

        width: min(100%, 820px);

        margin: 15px auto 0;
        padding: 0 4px;

        color:
          rgb(139 182 187 / 76%);

        font-size: 0.76rem;
        font-weight: 400;
        line-height: 1.5;
      }

      .helia-identification-storage-note-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;

        width: 18px;
        height: 18px;

        margin-top: 1px;

        color:
          var(--helia-id-accent);
      }

      .helia-identification-storage-note-icon svg {
        width: 17px;
        height: 17px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2;
      }

      /* ===================================================
         TABLETTES ET ORDINATEURS
         =================================================== */

      @media (min-width: 700px) {
        .screen.helia-identification-page {
          padding-top:
            max(
              25px,
              env(safe-area-inset-top)
            );

          padding-bottom:
            max(
              42px,
              env(safe-area-inset-bottom)
            );
        }

        .helia-identification-intro {
          grid-template-columns:
            90px minmax(0, 1fr);

          gap: 21px;

          margin-bottom: 22px;
        }

        .helia-identification-primary-fields,
        .helia-identification-optional-panel {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .helia-identification-field:has(#survey-name),
        .helia-identification-field:has(#survey-notes),
        .helia-identification-field:has(#local-name) {
          grid-column: 1 / -1;
        }

        .helia-identification-page
          > .content-card {
          padding: 30px 34px;
        }
      }

      @media (min-width: 700px) {
        .helia-identification-field-full-width {
          grid-column: 1 / -1;
        }
      }

      /* ===================================================
         PETITS ÉCRANS
         =================================================== */

      @media (max-width: 390px) {
        .helia-identification-page
          .screen-header
          .button-icon
          span:last-child {
          display: none;
        }

        .helia-identification-page
          .screen-header
          .button-icon {
          width: 44px;
          min-width: 44px;

          padding: 8px;
        }

        .helia-identification-intro {
          grid-template-columns:
            62px minmax(0, 1fr);

          gap: 13px;
        }

        .helia-identification-page
          > .content-card {
          padding: 17px;

          border-radius: 20px;
        }

        .helia-identification-step-header {
          padding-bottom: 16px;
        }
      }

      /* ===================================================
         APPAREILS TACTILES
         =================================================== */

      @media (hover: none) {
        .helia-identification-submit:hover:not(:disabled) {
          border-color:
            rgb(43 225 216 / 59%)
            !important;

          background:
            linear-gradient(
              100deg,
              rgb(0 137 138 / 96%) 0%,
              rgb(0 91 103 / 95%) 100%
            ) !important;

          transform: none;
        }

        .helia-identification-optional-toggle:hover:not(:disabled) {
          border-color:
            rgb(57 213 205 / 25%)
            !important;

          background:
            rgb(0 26 31 / 36%)
            !important;
        }
      }

      /* ===================================================
         MOUVEMENTS RÉDUITS
         =================================================== */

      @media (
        prefers-reduced-motion:
        reduce
      ) {
        .helia-identification-page
          .text-input,
        .helia-identification-page
          textarea.text-input,
        .helia-identification-submit {
          transition: none;
        }
      }
    `;

    document.head.append(
      styleElement
    );
  }

  /**
   * Regroupe les mutations successives.
   */
  function scheduleEnhancement() {
    if (enhancementScheduled) {
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
   * Transforme l'écran
   * d'identification affiché.
   */
  function enhanceCurrentScreen() {
    if (!appElement) {
      return;
    }

    const page =
      findIdentificationPage();

    if (!page) {
      currentPage =
        null;

      optionalDetailsAreExpanded =
        false;

      return;
    }

    if (
      page.getAttribute(
        ENHANCED_ATTRIBUTE
      ) === "true"
    ) {
      updateOptionalDetailsState(
        page
      );

      return;
    }

    const content =
      Array.from(
        page.children
      ).find(
        (element) =>
          element.classList
            ?.contains(
              "content-card"
            )
      );

    const form =
      content?.querySelector(
        ":scope > form"
      );

    const header =
      Array.from(
        page.children
      ).find(
        (element) =>
          element.classList
            ?.contains(
              "screen-header"
            )
      );

    if (
      !content ||
      !form ||
      !header
    ) {
      return;
    }

    let survey;

    try {
      survey =
        window.HeliaInventory
          .getSurveySnapshot();
    } catch (error) {
      console.error(
        "Impossible de lire le relevé pour transformer l'écran d'identification :",
        error
      );

      return;
    }

    const isFirstLocal =
      Boolean(
        page.querySelector(
          "#survey-name"
        )
      );

    currentPage =
      page;

    optionalDetailsAreExpanded =
      false;

    page.setAttribute(
      ENHANCED_ATTRIBUTE,
      "true"
    );

    page.classList.add(
      "helia-identification-page"
    );

    insertBackground(
      page
    );

    prepareHeader(
      header
    );

    const intro =
      createCompactIdentity({
        isFirstLocal,
      });

    header.insertAdjacentElement(
      "afterend",
      intro
    );

    content.classList.add(
      "helia-identification-card"
    );

    form.classList.add(
      "helia-identification-form"
    );

    const stepHeader =
      createStepHeader({
        isFirstLocal,
        survey,
      });

    form.prepend(
      stepHeader
    );

    if (isFirstLocal) {
      prepareSurveyFields(
        page
      );
    }

    prepareLocalSection({
      page,
      isFirstLocal,
    });

    prepareSubmitButton({
      form,
      isFirstLocal,
    });

    insertStorageNote(
      page,
      content
    );

    updateOptionalDetailsState(
      page
    );
  }

  /**
   * Recherche l'écran grâce
   * au champ du local.
   *
   * @returns {HTMLElement|null}
   */
  function findIdentificationPage() {
    const localInput =
      appElement.querySelector(
        "#local-name"
      );

    const page =
      localInput?.closest(
        "main.screen"
      );

    return page ?? null;
  }

  /**
   * Ajoute le fond architectural.
   *
   * @param {HTMLElement} page Page.
   */
  function insertBackground(
    page
  ) {
    if (
      page.querySelector(
        `:scope > [${BACKGROUND_ATTRIBUTE}="true"]`
      )
    ) {
      return;
    }

    const background =
      createElement(
        "div",
        {
          className:
            "helia-identification-background",

          attributes: {
            [BACKGROUND_ATTRIBUTE]:
              "true",

            "aria-hidden":
              "true",
          },
        }
      );

    background.innerHTML = `
      <svg
        viewBox="0 0 1200 1800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="helia-identification-grid"
            width="46"
            height="46"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M46 0H0V46"
              fill="none"
              stroke="#169c9a"
              stroke-width="0.55"
              opacity="0.24"
            ></path>
          </pattern>

          <linearGradient
            id="helia-identification-lines"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="#009e99"
              stop-opacity="0.08"
            ></stop>

            <stop
              offset="55%"
              stop-color="#36d0ca"
              stop-opacity="0.65"
            ></stop>

            <stop
              offset="100%"
              stop-color="#009e99"
              stop-opacity="0.04"
            ></stop>
          </linearGradient>
        </defs>

        <rect
          width="1200"
          height="1800"
          fill="url(#helia-identification-grid)"
          opacity="0.32"
        ></rect>

        <g
          fill="none"
          stroke="url(#helia-identification-lines)"
          stroke-width="1.2"
          opacity="0.5"
        >
          <path
            d="M-90 275 176 86 448 255 211 461Z"
          ></path>

          <path
            d="M-18 337 176 196 371 311 194 463Z"
          ></path>

          <path
            d="M70 286v121l124 68"
          ></path>

          <path
            d="M171 205v133l127 72"
          ></path>

          <path
            d="M936 236 1276 112 1284 519 1001 613 936 551Z"
          ></path>

          <path
            d="M936 236 1022 309 1276 226"
          ></path>

          <path
            d="M1022 309v221"
          ></path>

          <path
            d="M1109 279v184"
          ></path>

          <path
            d="M1192 252v174"
          ></path>

          <rect
            x="1055"
            y="347"
            width="84"
            height="125"
          ></rect>

          <rect
            x="1162"
            y="313"
            width="76"
            height="119"
          ></rect>

          <path
            d="M-25 1305 258 1087 579 1281 310 1516Z"
          ></path>

          <path
            d="M105 1202v197l204 117"
          ></path>

          <path
            d="M258 1087v204l321-10"
          ></path>

          <path
            d="M790 1260 1061 1088 1312 1243 1024 1462Z"
          ></path>

          <path
            d="M1061 1088v210l251-55"
          ></path>

          <path
            d="M790 1260v178l234 24"
          ></path>
        </g>
      </svg>
    `;

    const glow =
      createElement(
        "div",
        {
          className:
            "helia-identification-glow",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    page.prepend(
      glow
    );

    page.prepend(
      background
    );
  }

  /**
   * Habille le bouton retour.
   *
   * @param {HTMLElement} header En-tête.
   */
  function prepareHeader(
    header
  ) {
    const backButton =
      header.querySelector(
        ":scope > button"
      );

    if (!backButton) {
      return;
    }

    const label =
      createElement(
        "span",
        {
          text:
            "Retour",
        }
      );

    const icon =
      createIcon(
        "back"
      );

    backButton.replaceChildren(
      icon,
      label
    );
  }

  /**
   * Crée l'identité compacte H-ELIA.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createCompactIdentity({
    isFirstLocal,
  }) {
    const intro =
      createElement(
        "section",
        {
          className:
            "helia-identification-intro",

          attributes: {
            [INTRO_ATTRIBUTE]:
              "true",

            "aria-label":
              isFirstLocal
                ? "Création d'un nouveau relevé"
                : "Ajout d'un local au relevé",
          },
        }
      );

    const logo =
      createElement(
        "div",
        {
          className:
            "helia-identification-logo",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    logo.innerHTML = `
      <svg viewBox="0 0 190 160">
        <defs>
          <linearGradient
            id="helia-identification-logo-left"
            x1="0"
            y1="1"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stop-color="#18c7b0"
            ></stop>

            <stop
              offset="100%"
              stop-color="#65e4cf"
            ></stop>
          </linearGradient>

          <linearGradient
            id="helia-identification-logo-right"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="#1bbbd0"
            ></stop>

            <stop
              offset="100%"
              stop-color="#006c76"
            ></stop>
          </linearGradient>

          <linearGradient
            id="helia-identification-logo-center"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="#00686d"
            ></stop>

            <stop
              offset="100%"
              stop-color="#01484f"
            ></stop>
          </linearGradient>
        </defs>

        <path
          d="M83 15C88 7 95 5 101 15L158 126C164 138 157 148 145 148H120L72 48Z"
          fill="url(#helia-identification-logo-right)"
        ></path>

        <path
          d="M83 15C88 7 95 5 101 15L113 39 72 121C65 135 58 148 42 148H24C11 148 5 137 11 125Z"
          fill="url(#helia-identification-logo-left)"
        ></path>

        <path
          d="M55 148C69 148 74 137 80 127 88 114 98 111 108 118 113 121 117 129 120 137L125 148Z"
          fill="url(#helia-identification-logo-center)"
        ></path>
      </svg>
    `;

    const copy =
      createElement(
        "div",
        {
          className:
            "helia-identification-brand-copy",
        }
      );

    copy.append(
      createElement(
        "p",
        {
          className:
            "helia-identification-suite",

          text:
            "ATLAS",
        }
      ),

      createElement(
        "p",
        {
          className:
            "helia-identification-brand-name",

          text:
            "H-ELIA",
        }
      ),

      createElement(
        "p",
        {
          className:
            "helia-identification-brand-description",

          text:
            isFirstLocal
              ? "Création d’un nouveau relevé"
              : "Ajouter un local au relevé",
        }
      )
    );

    intro.append(
      logo,
      copy
    );

    return intro;
  }

  /**
   * Crée l'en-tête fonctionnel
   * de la carte.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createStepHeader({
    isFirstLocal,
    survey,
  }) {
    const header =
      createElement(
        "header",
        {
          className:
            "helia-identification-step-header",

          attributes: {
            [STEP_HEADER_ATTRIBUTE]:
              "true",
          },
        }
      );

    header.append(
      createElement(
        "span",
        {
          className:
            "helia-identification-step-badge",

          text:
            isFirstLocal
              ? "Étape 1"
              : "Nouveau local",
        }
      ),

      createElement(
        "h2",
        {
          className:
            "helia-identification-step-title",

          text:
            isFirstLocal
              ? "Identifier le relevé"
              : "Identifier le local",
        }
      ),

      createElement(
        "p",
        {
          className:
            "helia-identification-step-description",

          text:
            isFirstLocal
              ? "Renseignez les informations principales du relevé, puis indiquez le premier local à inventorier."
              : "Donnez un nom ou un identifiant au nouveau local. Les locaux et objets déjà enregistrés seront conservés.",
        }
      )
    );

    if (!isFirstLocal) {
      header.append(
        createElement(
          "div",
          {
            className:
              "helia-identification-current-survey",

            text:
              `Relevé actuel · ${
                survey.displayName ||
                "Relevé en cours"
              }`,
          }
        )
      );
    }

    return header;
  }

  /**
   * Réorganise les informations
   * du relevé.
   *
   * @param {HTMLElement} page Page.
   */
  function prepareSurveyFields(
    page
  ) {
    const title =
      page.querySelector(
        "#survey-information-title"
      );

    const section =
      title?.closest(
        "section"
      );

    if (!section) {
      return;
    }

    section.classList.add(
      "helia-identification-survey-section"
    );

    const nameContainer =
      getFieldContainer(
        page,
        "survey-name"
      );

    const dateContainer =
      getFieldContainer(
        page,
        "survey-date"
      );

    if (
      !nameContainer ||
      !dateContainer
    ) {
      return;
    }

    decorateFieldContainer(
      nameContainer,
      "survey-name"
    );

    decorateFieldContainer(
      dateContainer,
      "survey-date"
    );

    const primaryFields =
      createElement(
        "div",
        {
          className:
            "helia-identification-primary-fields",

          attributes: {
            [PRIMARY_FIELDS_ATTRIBUTE]:
              "true",
          },
        }
      );

    primaryFields.append(
      nameContainer,
      dateContainer
    );

    const optionalToggle =
      createOptionalToggle();

    const optionalPanel =
      createElement(
        "div",
        {
          className:
            "helia-identification-optional-panel",

          attributes: {
            [OPTIONAL_PANEL_ATTRIBUTE]:
              "true",
          },
        }
      );

    OPTIONAL_FIELD_IDS.forEach(
      (fieldId) => {
        const container =
          getFieldContainer(
            page,
            fieldId
          );

        if (!container) {
          return;
        }

        decorateFieldContainer(
          container,
          fieldId
        );

        optionalPanel.append(
          container
        );
      }
    );

    section.append(
      primaryFields,
      optionalToggle,
      optionalPanel
    );
  }

  /**
   * Crée le bouton des informations
   * facultatives.
   *
   * @returns {HTMLButtonElement}
   */
  function createOptionalToggle() {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "button helia-identification-optional-toggle";

    button.setAttribute(
      OPTIONAL_TOGGLE_ATTRIBUTE,
      "true"
    );

    button.addEventListener(
      "click",
      () => {
        optionalDetailsAreExpanded =
          !optionalDetailsAreExpanded;

        if (currentPage) {
          updateOptionalDetailsState(
            currentPage
          );
        }
      }
    );

    return button;
  }

  /**
   * Applique l'état du panneau
   * facultatif.
   *
   * @param {HTMLElement} page Page.
   */
  function updateOptionalDetailsState(
    page
  ) {
    const button =
      page.querySelector(
        `[${OPTIONAL_TOGGLE_ATTRIBUTE}="true"]`
      );

    const panel =
      page.querySelector(
        `[${OPTIONAL_PANEL_ATTRIBUTE}="true"]`
      );

    if (
      !button ||
      !panel
    ) {
      return;
    }

    const title =
      createElement(
        "span",
        {
          className:
            "helia-identification-toggle-title",

          text:
            optionalDetailsAreExpanded
              ? "Masquer les informations complémentaires"
              : "Informations complémentaires",
        }
      );

    const description =
      createElement(
        "span",
        {
          className:
            "helia-identification-toggle-description",

          text:
            "Référence, site, bâtiment, unité, opérateur et notes",
        }
      );

    const copy =
      createElement(
        "span",
        {
          className:
            "helia-identification-toggle-copy",
        }
      );

    copy.append(
      title,
      description
    );

    const icon =
      createElement(
        "span",
        {
          className:
            "helia-identification-toggle-icon",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    icon.innerHTML =
      optionalDetailsAreExpanded
        ? ICONS.collapse
        : ICONS.expand;

    button.replaceChildren(
      copy,
      icon
    );

    button.setAttribute(
      "aria-expanded",
      String(
        optionalDetailsAreExpanded
      )
    );

    setElementVisibility(
      panel,
      optionalDetailsAreExpanded
    );
  }

  /**
   * Prépare la section du local.
   *
   * @param {Object} options Paramètres.
   */
  function prepareLocalSection({
    page,
    isFirstLocal,
  }) {
    const localInput =
      page.querySelector(
        "#local-name"
      );

    const section =
      localInput?.closest(
        "section"
      );

    const container =
      localInput?.closest(
        ".field-group"
      );

    if (
      !section ||
      !container
    ) {
      return;
    }

    section.classList.add(
      "helia-identification-local-section"
    );

    decorateFieldContainer(
      container,
      "local-name"
    );

    const title =
      Array.from(
        section.children
      ).find(
        (element) =>
          element.classList
            ?.contains(
              "summary-title"
            )
      );

    if (title) {
      title.textContent =
        isFirstLocal
          ? "Premier local"
          : "Nouveau local";
    }

    const explanation =
      createElement(
        "p",
        {
          className:
            "helia-identification-local-explanation",

          text:
            isFirstLocal
              ? "Ce local sera ouvert directement dans l’écran de scan."
              : "Le nouveau local sera ajouté au relevé sans modifier les précédents.",

          attributes: {
            [LOCAL_EXPLANATION_ATTRIBUTE]:
              "true",
          },
        }
      );

    if (title) {
      title.insertAdjacentElement(
        "afterend",
        explanation
      );
    } else {
      section.prepend(
        explanation
      );
    }
  }

  /**
   * Habille le bouton d'envoi existant.
   *
   * @param {Object} options Paramètres.
   */
  function prepareSubmitButton({
    form,
    isFirstLocal,
  }) {
    const button =
      Array.from(
        form.children
      ).find(
        (element) =>
          element instanceof
            HTMLButtonElement &&
          element.type ===
            "submit"
      );

    if (!button) {
      return;
    }

    button.classList.add(
      "helia-identification-submit"
    );

    const label =
      createElement(
        "span",
        {
          text:
            isFirstLocal
              ? "Créer le relevé et continuer"
              : "Créer le local et continuer",
        }
      );

    const icon =
      createElement(
        "span",
        {
          className:
            "helia-identification-submit-icon",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    icon.innerHTML =
      ICONS.chevron;

    button.replaceChildren(
      label,
      icon
    );
  }

  /**
   * Ajoute la note de sauvegarde.
   *
   * @param {HTMLElement} page Page.
   * @param {HTMLElement} content Carte.
   */
  function insertStorageNote(
    page,
    content
  ) {
    if (
      page.querySelector(
        `[${STORAGE_NOTE_ATTRIBUTE}="true"]`
      )
    ) {
      return;
    }

    const note =
      createElement(
        "p",
        {
          className:
            "helia-identification-storage-note",

          attributes: {
            [STORAGE_NOTE_ATTRIBUTE]:
              "true",
          },
        }
      );

    const icon =
      createElement(
        "span",
        {
          className:
            "helia-identification-storage-note-icon",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    icon.innerHTML =
      ICONS.check;

    const text =
      createElement(
        "span",
        {
          text:
            "Les données sont enregistrées automatiquement sur cet appareil.",
        }
      );

    note.append(
      icon,
      text
    );

    content.insertAdjacentElement(
      "afterend",
      note
    );
  }

  /**
   * Recherche le conteneur
   * d'un champ.
   *
   * @param {HTMLElement} page Page.
   * @param {string} fieldId Identifiant.
   * @returns {HTMLElement|null}
   */
  function getFieldContainer(
    page,
    fieldId
  ) {
    return (
      page
        .querySelector(
          `#${fieldId}`
        )
        ?.closest(
          ".field-group"
        ) ?? null
    );
  }

  /**
   * Ajoute les classes d'un champ.
   *
   * @param {HTMLElement} container Conteneur.
   * @param {string} fieldId Identifiant.
   */
  function decorateFieldContainer(
    container,
    fieldId
  ) {
    container.classList.add(
      "helia-identification-field"
    );

    container.setAttribute(
      "data-helia-identification-field",
      fieldId
    );

    if (
      [
        "survey-name",
        "survey-notes",
        "local-name",
      ].includes(
        fieldId
      )
    ) {
      container.classList.add(
        "helia-identification-field-full-width"
      );
    }
  }

  /**
   * Affiche ou masque un élément.
   *
   * @param {HTMLElement|null} element Élément.
   * @param {boolean} isVisible Visibilité.
   */
  function setElementVisibility(
    element,
    isVisible
  ) {
    if (!element) {
      return;
    }

    if (isVisible) {
      element.hidden =
        false;

      element.style.removeProperty(
        "display"
      );

      element.removeAttribute(
        "aria-hidden"
      );

      return;
    }

    element.hidden =
      true;

    element.style.setProperty(
      "display",
      "none",
      "important"
    );

    element.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  /**
   * Crée une icône SVG.
   *
   * @param {string} iconName Nom.
   * @returns {HTMLElement}
   */
  function createIcon(
    iconName
  ) {
    const icon =
      createElement(
        "span",
        {
          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    icon.innerHTML =
      ICONS[iconName] || "";

    return icon;
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
      text = null,
      attributes = {},
    } = {}
  ) {
    const element =
      document.createElement(
        tagName
      );

    if (id) {
      element.id =
        id;
    }

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
          value === null ||
          value === undefined ||
          value === false
        ) {
          return;
        }

        element.setAttribute(
          name,
          value === true
            ? ""
            : String(value)
        );
      }
    );

    return element;
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

    currentPage =
      null;

    enhancementScheduled =
      false;

    optionalDetailsAreExpanded =
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
        "L'écran d'identification H-ELIA n'a pas pu démarrer :",
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