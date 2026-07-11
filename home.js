"use strict";

/**
 * Accueil immersif d'ATLAS H-ELIA.
 *
 * Ce module :
 * - remplace visuellement l'accueil généré par ui.js ;
 * - conserve les actions existantes de navigation ;
 * - affiche un monogramme A et le nom H-ELIA ;
 * - présente le relevé dans une interface sombre et vitrée ;
 * - affiche les locaux, types d'objets et objets enregistrés ;
 * - ne présente aucun taux de complétion ;
 * - permet de commencer un nouveau relevé avec confirmation ;
 * - fonctionne sans image ni bibliothèque graphique externe.
 */
window.HeliaHome = (() => {
  const APP_ELEMENT_ID =
    "app";

  const STYLE_ELEMENT_ID =
    "helia-home-cinematic-styles";

  const ENHANCED_ATTRIBUTE =
    "data-helia-home-cinematic";

  const ALERT_ATTRIBUTE =
    "data-helia-home-alert";

  let appElement =
    null;

  let observer =
    null;

  let enhancementScheduled =
    false;

  /**
   * Icônes utilisées par l'accueil.
   *
   * Les SVG sont intégrés au fichier :
   * aucune dépendance externe n'est nécessaire.
   */
  const ICONS =
    Object.freeze({
      clipboard: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="5"
            y="4.5"
            width="14"
            height="16"
            rx="2.2"
          ></rect>

          <path
            d="M9 4.5V3.8A1.8 1.8 0 0 1 10.8 2h2.4A1.8 1.8 0 0 1 15 3.8v.7"
          ></path>

          <path d="M9 10h6"></path>
          <path d="M9 14h6"></path>
          <path d="M9 18h4"></path>
        </svg>
      `,

      rooms: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 8.2 12 3l8 5.2v8.9L12 22l-8-4.9Z"
          ></path>

          <path d="M4 8.2 12 13l8-4.8"></path>
          <path d="M12 13v9"></path>
        </svg>
      `,

      types: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="3"
            y="4"
            width="7"
            height="7"
            rx="1.5"
          ></rect>

          <rect
            x="14"
            y="4"
            width="7"
            height="7"
            rx="1.5"
          ></rect>

          <rect
            x="3"
            y="15"
            width="7"
            height="6"
            rx="1.5"
          ></rect>

          <rect
            x="14"
            y="15"
            width="7"
            height="6"
            rx="1.5"
          ></rect>
        </svg>
      `,

      objects: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="m4 7 8-4 8 4-8 4Z"
          ></path>

          <path
            d="M4 7v10l8 4 8-4V7"
          ></path>

          <path d="M12 11v10"></path>
        </svg>
      `,

      play: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="m9 6 9 6-9 6Z"
          ></path>
        </svg>
      `,

      plus: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 4v16"></path>
          <path d="M4 12h16"></path>
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

      shield: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M12 3 20 6v5.5c0 4.7-3.2 8-8 9.5-4.8-1.5-8-4.8-8-9.5V6Z"
          ></path>

          <rect
            x="9"
            y="10.5"
            width="6"
            height="5"
            rx="1"
          ></rect>

          <path
            d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5"
          ></path>
        </svg>
      `,

      brain: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M9.5 4.5A3 3 0 0 0 5 7.1a3 3 0 0 0-1 5.7A3.1 3.1 0 0 0 7 17a3 3 0 0 0 5 2.2V6.5a2.5 2.5 0 0 0-2.5-2Z"
          ></path>

          <path
            d="M14.5 4.5A3 3 0 0 1 19 7.1a3 3 0 0 1 1 5.7A3.1 3.1 0 0 1 17 17a3 3 0 0 1-5 2.2V6.5a2.5 2.5 0 0 1 2.5-2Z"
          ></path>

          <path d="M8 9.5h2"></path>
          <path d="M14 9.5h2"></path>
          <path d="M8 14.5h2"></path>
          <path d="M14 14.5h2"></path>
        </svg>
      `,

      bolt: `
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M13.5 2 5 13h6l-1 9 9-12h-6Z"
          ></path>
        </svg>
      `,
    });

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
        `L'accueil H-ELIA attend le conteneur #${appElementId}.`
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
   * Vérifie les modules requis.
   */
  function validateDependencies() {
    const missingDependencies =
      [];

    if (!window.HeliaInventory) {
      missingDependencies.push(
        "HeliaInventory"
      );
    }

    if (!window.HeliaNavigation) {
      missingDependencies.push(
        "HeliaNavigation"
      );
    }

    if (!window.HELIA_SCREENS) {
      missingDependencies.push(
        "HELIA_SCREENS"
      );
    }

    if (
      missingDependencies.length >
      0
    ) {
      throw new Error(
        "Dépendances manquantes pour home.js : " +
          missingDependencies.join(
            ", "
          ) +
          "."
      );
    }
  }

  /**
   * Ajoute l'ensemble du style
   * du nouvel écran d'accueil.
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
      .screen-home.helia-home-cinematic {
        --helia-home-background: #02181d;
        --helia-home-background-deep: #011116;
        --helia-home-panel: rgb(5 60 68 / 74%);
        --helia-home-panel-strong: rgb(4 53 61 / 91%);
        --helia-home-border: rgb(66 218 211 / 36%);
        --helia-home-border-soft: rgb(92 216 211 / 18%);
        --helia-home-turquoise: #18d2ca;
        --helia-home-turquoise-soft: #75ebe5;
        --helia-home-white: #f4ffff;
        --helia-home-muted: #89afb4;
        --helia-home-success: #54e99a;

        position: relative;
        isolation: isolate;

        display: block;

        width: 100%;
        max-width: none;
        min-height: 100vh;
        min-height: 100dvh;

        margin: 0;

        padding:
          max(24px, env(safe-area-inset-top))
          max(16px, env(safe-area-inset-right))
          max(34px, env(safe-area-inset-bottom))
          max(16px, env(safe-area-inset-left));

        overflow: hidden;

        color:
          var(--helia-home-white);

        background:
          radial-gradient(
            circle at 50% 8%,
            rgb(0 158 153 / 18%),
            transparent 28rem
          ),
          radial-gradient(
            circle at 8% 45%,
            rgb(0 158 153 / 8%),
            transparent 25rem
          ),
          linear-gradient(
            180deg,
            var(--helia-home-background) 0%,
            var(--helia-home-background-deep) 100%
          );
      }

      .helia-home-cinematic *,
      .helia-home-cinematic *::before,
      .helia-home-cinematic *::after {
        box-sizing: border-box;
      }

      .helia-home-blueprint-background {
        position: absolute;
        z-index: -2;
        inset: 0;

        width: 100%;
        height: 100%;

        overflow: hidden;

        pointer-events: none;
      }

      .helia-home-blueprint-background svg {
        display: block;

        width: 100%;
        height: 100%;

        opacity: 0.28;
      }

      .helia-home-blueprint-background::after {
        position: absolute;
        inset: 0;

        background:
          linear-gradient(
            180deg,
            transparent 0%,
            transparent 52%,
            rgb(1 17 22 / 65%) 80%,
            var(--helia-home-background-deep) 100%
          );

        content: "";
      }

      .helia-home-glow {
        position: absolute;
        z-index: -1;
        top: 0;
        left: 50%;

        width: min(90vw, 780px);
        height: 540px;

        border-radius: 50%;

        background:
          radial-gradient(
            circle,
            rgb(0 205 196 / 13%) 0%,
            transparent 69%
          );

        pointer-events: none;

        transform:
          translateX(-50%);
      }

      .helia-home-shell {
        position: relative;
        z-index: 1;

        display: flex;
        flex-direction: column;
        gap: 20px;

        width: min(100%, 820px);

        margin: 0 auto;
      }

      /* =====================================================
         IDENTITÉ VISUELLE
         ===================================================== */

      .helia-home-brand {
        display: flex;
        flex-direction: column;
        align-items: center;

        width: 100%;

        padding: 10px 0 20px;

        text-align: center;
      }

      .helia-home-logo {
        position: relative;

        width: clamp(108px, 29vw, 158px);
        height: auto;

        margin-bottom: 10px;

        filter:
          drop-shadow(
            0 14px 26px
            rgb(0 207 197 / 19%)
          );
      }

      .helia-home-logo svg {
        display: block;

        width: 100%;
        height: auto;
      }

      .helia-home-suite {
        margin: 0 0 4px;

        color:
          var(--helia-home-turquoise-soft);

        font-size: clamp(
          0.62rem,
          2.2vw,
          0.76rem
        );

        font-weight: 760;
        letter-spacing: 0.34em;
        line-height: 1.2;
        text-transform: uppercase;

        opacity: 0.72;
      }

      .helia-home-title {
        margin: 0;

        color:
          var(--helia-home-white);

        font-size: clamp(
          2.65rem,
          13vw,
          5.3rem
        );

        font-weight: 400;
        letter-spacing: 0.1em;
        line-height: 1;

        text-indent: 0.1em;

        text-shadow:
          0 3px 14px
          rgb(255 255 255 / 13%);
      }

      .helia-home-description {
        max-width: 670px;

        margin: 15px 0 0;

        color:
          var(--helia-home-turquoise-soft);

        font-size: clamp(
          0.9rem,
          3.4vw,
          1.14rem
        );

        font-weight: 430;
        line-height: 1.5;
      }

      /* =====================================================
         CARTE DU RELEVÉ
         ===================================================== */

      .helia-home-survey-card,
      .helia-home-empty-card {
        position: relative;

        display: flex;
        flex-direction: column;
        gap: 20px;

        width: 100%;
        min-width: 0;

        padding: clamp(
          20px,
          5vw,
          30px
        );

        overflow: hidden;

        border:
          1px solid
          var(--helia-home-border);

        border-radius: 25px;

        background:
          linear-gradient(
            145deg,
            rgb(9 78 86 / 78%) 0%,
            rgb(3 36 42 / 88%) 100%
          );

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 5%),
          0 24px 60px
          rgb(0 0 0 / 28%);

        backdrop-filter:
          blur(18px);

        -webkit-backdrop-filter:
          blur(18px);
      }

      .helia-home-survey-card::before,
      .helia-home-empty-card::before {
        position: absolute;
        top: -45%;
        left: -20%;

        width: 80%;
        height: 110%;

        border-radius: 50%;

        background:
          radial-gradient(
            circle,
            rgb(38 220 211 / 8%),
            transparent 68%
          );

        content: "";
        pointer-events: none;
      }

      .helia-home-survey-header {
        position: relative;
        z-index: 1;

        display: grid;
        grid-template-columns:
          auto minmax(0, 1fr);
        align-items: center;
        gap: 15px;

        min-width: 0;
      }

      .helia-home-survey-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 58px;
        height: 58px;

        border:
          1px solid
          rgb(36 225 216 / 47%);

        border-radius: 50%;

        color:
          var(--helia-home-turquoise-soft);

        background:
          radial-gradient(
            circle,
            rgb(0 193 184 / 28%),
            rgb(0 102 104 / 35%)
          );

        box-shadow:
          inset 0 0 18px
          rgb(58 255 245 / 13%),
          0 0 24px
          rgb(0 204 195 / 11%);
      }

      .helia-home-survey-icon svg {
        width: 29px;
        height: 29px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.65;
      }

      .helia-home-survey-heading {
        min-width: 0;
      }

      .helia-home-eyebrow {
        margin: 0 0 6px;

        color:
          rgb(238 255 255 / 82%);

        font-size: 0.73rem;
        font-weight: 680;
        letter-spacing: 0.09em;
        line-height: 1.3;
        text-transform: uppercase;
      }

      .helia-home-survey-name {
        margin: 0;

        color:
          var(--helia-home-white);

        font-size: clamp(
          1.25rem,
          5vw,
          1.8rem
        );

        font-weight: 530;
        line-height: 1.25;

        overflow-wrap: anywhere;
      }

      .helia-home-survey-date {
        margin: 7px 0 0;

        color:
          var(--helia-home-turquoise-soft);

        font-size: 0.84rem;
        font-weight: 450;
        line-height: 1.45;

        overflow-wrap: anywhere;
      }

      .helia-home-room-preview {
        position: relative;

        display: none;

        min-width: 0;
        min-height: 130px;

        overflow: hidden;

        border:
          1px solid
          rgb(55 205 199 / 27%);

        border-radius: 16px;

        background:
          linear-gradient(
            145deg,
            rgb(1 30 36 / 57%),
            rgb(3 46 51 / 42%)
          );
      }

      .helia-home-room-preview::after {
        position: absolute;
        inset: 0;

        background:
          radial-gradient(
            circle at center,
            transparent 30%,
            rgb(1 21 25 / 38%) 100%
          );

        content: "";
        pointer-events: none;
      }

      .helia-home-room-preview svg {
        display: block;

        width: 100%;
        height: 100%;

        min-height: 130px;
      }

      .helia-home-location {
        position: relative;
        z-index: 1;

        display: flex;
        align-items: flex-start;
        gap: 9px;

        margin: -4px 0 0;

        color:
          var(--helia-home-muted);

        font-size: 0.82rem;
        font-weight: 480;
        line-height: 1.45;

        overflow-wrap: anywhere;
      }

      .helia-home-location::before {
        flex: 0 0 auto;

        color:
          var(--helia-home-turquoise);

        content: "●";

        font-size: 0.58rem;
        line-height: 1.9;
      }

      /* =====================================================
         STATISTIQUES
         ===================================================== */

      .helia-home-statistics {
        position: relative;
        z-index: 1;

        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));

        width: 100%;

        overflow: hidden;

        border:
          1px solid
          var(--helia-home-border-soft);

        border-radius: 17px;

        background:
          rgb(1 25 30 / 29%);
      }

      .helia-home-statistic {
        position: relative;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 7px;

        min-width: 0;
        min-height: 132px;

        padding: 15px 7px;

        text-align: center;
      }

      .helia-home-statistic +
      .helia-home-statistic {
        border-left:
          1px solid
          var(--helia-home-border-soft);
      }

      .helia-home-statistic-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 42px;
        height: 42px;

        border:
          1px solid
          rgb(44 222 214 / 52%);

        border-radius: 50%;

        color:
          var(--helia-home-turquoise);

        background:
          rgb(0 158 153 / 8%);

        box-shadow:
          0 0 19px
          rgb(0 202 193 / 10%);
      }

      .helia-home-statistic:nth-child(2)
      .helia-home-statistic-icon {
        color:
          var(--helia-home-success);

        border-color:
          rgb(84 233 154 / 52%);

        background:
          rgb(84 233 154 / 8%);
      }

      .helia-home-statistic:nth-child(3)
      .helia-home-statistic-icon {
        color:
          #5eb8ff;

        border-color:
          rgb(94 184 255 / 50%);

        background:
          rgb(94 184 255 / 7%);
      }

      .helia-home-statistic-icon svg {
        width: 22px;
        height: 22px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.55;
      }

      .helia-home-statistic-value {
        color:
          var(--helia-home-white);

        font-size: clamp(
          1.45rem,
          7vw,
          2.25rem
        );

        font-weight: 430;
        line-height: 1;
      }

      .helia-home-statistic-label {
        max-width: 110px;

        color:
          var(--helia-home-turquoise-soft);

        font-size: clamp(
          0.64rem,
          2.4vw,
          0.82rem
        );

        font-weight: 460;
        line-height: 1.3;

        overflow-wrap: anywhere;
      }

      /* =====================================================
         ACTIONS
         ===================================================== */

      .helia-home-actions {
        display: flex;
        flex-direction: column;
        gap: 13px;

        width: 100%;
      }

      .helia-home-action {
        position: relative;

        display: grid !important;
        grid-template-columns:
          auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 15px;

        width: 100% !important;
        max-width: none !important;
        min-height: 94px;

        padding: 15px 18px !important;

        border-radius: 18px !important;

        color:
          var(--helia-home-white) !important;

        text-align: left !important;

        transition:
          transform 160ms ease,
          border-color 160ms ease,
          background-color 160ms ease,
          box-shadow 160ms ease;
      }

      .helia-home-action-primary {
        border:
          1px solid
          rgb(34 226 216 / 55%) !important;

        background:
          linear-gradient(
            100deg,
            rgb(0 126 129 / 92%) 0%,
            rgb(0 94 104 / 90%) 100%
          ) !important;

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 7%),
          0 16px 36px
          rgb(0 110 112 / 16%);
      }

      .helia-home-action-secondary {
        border:
          1px solid
          rgb(31 209 200 / 49%) !important;

        background:
          rgb(2 32 38 / 62%) !important;

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 3%);
      }

      .helia-home-action:hover:not(:disabled) {
        transform:
          translateY(-2px);
      }

      .helia-home-action-primary:hover:not(:disabled) {
        border-color:
          var(--helia-home-turquoise) !important;

        background:
          linear-gradient(
            100deg,
            rgb(0 146 147 / 96%) 0%,
            rgb(0 107 116 / 96%) 100%
          ) !important;

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 9%),
          0 20px 40px
          rgb(0 158 153 / 22%);
      }

      .helia-home-action-secondary:hover:not(:disabled) {
        border-color:
          var(--helia-home-turquoise) !important;

        background:
          rgb(4 50 57 / 77%) !important;
      }

      .helia-home-action:active:not(:disabled) {
        transform:
          translateY(0);
      }

      .helia-home-action-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 50px;
        height: 50px;

        border:
          1px solid
          rgb(64 239 230 / 48%);

        border-radius: 50%;

        color:
          var(--helia-home-turquoise-soft);

        background:
          rgb(0 30 36 / 24%);
      }

      .helia-home-action-icon svg {
        width: 25px;
        height: 25px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
      }

      .helia-home-action-copy {
        display: flex;
        flex-direction: column;
        gap: 5px;

        min-width: 0;
      }

      .helia-home-action-title {
        color:
          var(--helia-home-white);

        font-size: clamp(
          1rem,
          4vw,
          1.28rem
        );

        font-weight: 520;
        line-height: 1.25;

        overflow-wrap: anywhere;
      }

      .helia-home-action-description {
        color:
          var(--helia-home-turquoise-soft);

        font-size: clamp(
          0.73rem,
          2.9vw,
          0.9rem
        );

        font-weight: 410;
        line-height: 1.35;

        opacity: 0.82;

        overflow-wrap: anywhere;
      }

      .helia-home-action-chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        color:
          rgb(168 237 234 / 76%);
      }

      .helia-home-action-chevron svg {
        width: 24px;
        height: 24px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.9;
      }

      /* =====================================================
         ÉTAT VIDE
         ===================================================== */

      .helia-home-empty-card {
        align-items: center;

        padding-top:
          clamp(28px, 8vw, 50px);

        padding-bottom:
          clamp(28px, 8vw, 50px);

        text-align: center;
      }

      .helia-home-empty-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 72px;
        height: 72px;

        border:
          1px solid
          var(--helia-home-border);

        border-radius: 50%;

        color:
          var(--helia-home-turquoise);

        background:
          rgb(0 158 153 / 10%);
      }

      .helia-home-empty-icon svg {
        width: 34px;
        height: 34px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.5;
      }

      .helia-home-empty-title {
        margin: 0;

        color:
          var(--helia-home-white);

        font-size: clamp(
          1.35rem,
          6vw,
          1.9rem
        );

        font-weight: 520;
      }

      .helia-home-empty-description {
        max-width: 510px;

        margin: -6px 0 4px;

        color:
          var(--helia-home-muted);

        font-size: 0.9rem;
        line-height: 1.55;
      }

      /* =====================================================
         ARGUMENTS DU BAS
         ===================================================== */

      .helia-home-benefits {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));

        width: 100%;

        margin-top: 13px;
        padding-top: 25px;

        border-top:
          1px solid
          rgb(89 208 203 / 12%);
      }

      .helia-home-benefit {
        display: grid;
        grid-template-columns:
          auto minmax(0, 1fr);
        align-items: center;
        gap: 9px;

        min-width: 0;

        padding: 4px 8px;
      }

      .helia-home-benefit-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 35px;
        height: 35px;

        color:
          rgb(117 202 205 / 68%);
      }

      .helia-home-benefit-icon svg {
        width: 30px;
        height: 30px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.35;
      }

      .helia-home-benefit-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;

        min-width: 0;
      }

      .helia-home-benefit-title {
        color:
          rgb(228 250 250 / 77%);

        font-size: clamp(
          0.68rem,
          2.5vw,
          0.83rem
        );

        font-weight: 520;
        line-height: 1.25;
      }

      .helia-home-benefit-description {
        color:
          var(--helia-home-muted);

        font-size: clamp(
          0.58rem,
          2.1vw,
          0.72rem
        );

        font-weight: 410;
        line-height: 1.3;

        opacity: 0.76;
      }

      /* =====================================================
         ERREURS ET VERSION
         ===================================================== */

      .helia-home-alert {
        width: 100%;

        margin: 0;
        padding: 13px 15px;

        border:
          1px solid
          rgb(225 96 33 / 64%);

        border-radius: 14px;

        color:
          #ffe6d9;

        background:
          rgb(225 96 33 / 12%);

        font-size: 0.85rem;
        font-weight: 570;
        line-height: 1.45;
      }

      .helia-home-version {
        width: 100%;

        margin: 0;
        padding: 3px 0 0;

        color:
          rgb(121 166 171 / 55%);

        font-size: 0.67rem;
        font-weight: 430;
        letter-spacing: 0.04em;
        text-align: center;
      }

      /* =====================================================
         TABLETTES ET ORDINATEURS
         ===================================================== */

      @media (min-width: 700px) {
        .screen-home.helia-home-cinematic {
          padding-top:
            max(
              34px,
              env(safe-area-inset-top)
            );

          padding-bottom:
            max(
              42px,
              env(safe-area-inset-bottom)
            );
        }

        .helia-home-shell {
          gap: 24px;
        }

        .helia-home-brand {
          padding-top: 4px;
          padding-bottom: 24px;
        }

        .helia-home-survey-card {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(220px, 0.68fr);
          gap: 22px;
        }

        .helia-home-survey-header {
          align-self: center;
        }

        .helia-home-room-preview {
          display: block;

          grid-column: 2;
          grid-row: 1 / span 2;
        }

        .helia-home-location {
          grid-column: 1;
        }

        .helia-home-statistics {
          grid-column: 1 / -1;
        }

        .helia-home-action {
          min-height: 102px;

          padding-right:
            24px !important;

          padding-left:
            24px !important;
        }
      }

      /* =====================================================
         TRÈS PETITS ÉCRANS
         ===================================================== */

      @media (max-width: 390px) {
        .screen-home.helia-home-cinematic {
          padding-right:
            max(
              11px,
              env(safe-area-inset-right)
            );

          padding-left:
            max(
              11px,
              env(safe-area-inset-left)
            );
        }

        .helia-home-shell {
          gap: 15px;
        }

        .helia-home-brand {
          padding-bottom: 13px;
        }

        .helia-home-survey-card,
        .helia-home-empty-card {
          padding: 16px;

          border-radius: 20px;
        }

        .helia-home-survey-icon {
          width: 49px;
          height: 49px;
        }

        .helia-home-statistic {
          min-height: 116px;

          padding-right: 4px;
          padding-left: 4px;
        }

        .helia-home-statistic-icon {
          width: 36px;
          height: 36px;
        }

        .helia-home-action {
          min-height: 84px;

          padding:
            12px !important;
        }

        .helia-home-action-icon {
          width: 43px;
          height: 43px;
        }

        .helia-home-benefit {
          display: flex;
          flex-direction: column;
          gap: 4px;

          text-align: center;
        }
      }

      /* =====================================================
         PAYSAGE SUR TÉLÉPHONE
         ===================================================== */

      @media (
        orientation: landscape
      ) and (
        max-height: 620px
      ) {
        .helia-home-brand {
          padding-bottom: 10px;
        }

        .helia-home-logo {
          width: 85px;
        }

        .helia-home-title {
          font-size: 2.5rem;
        }

        .helia-home-description {
          margin-top: 8px;
        }
      }

      /* =====================================================
         APPAREILS TACTILES
         ===================================================== */

      @media (hover: none) {
        .helia-home-action:hover:not(:disabled) {
          transform: none;
        }

        .helia-home-action-primary:hover:not(:disabled) {
          border-color:
            rgb(34 226 216 / 55%)
            !important;

          background:
            linear-gradient(
              100deg,
              rgb(0 126 129 / 92%) 0%,
              rgb(0 94 104 / 90%) 100%
            )
            !important;
        }

        .helia-home-action-secondary:hover:not(:disabled) {
          border-color:
            rgb(31 209 200 / 49%)
            !important;

          background:
            rgb(2 32 38 / 62%)
            !important;
        }
      }

      /* =====================================================
         MOUVEMENTS RÉDUITS
         ===================================================== */

      @media (
        prefers-reduced-motion: reduce
      ) {
        .helia-home-action {
          transition: none;
        }
      }
    `;

    document.head.append(
      styleElement
    );
  }

  /**
   * Programme une seule transformation
   * après une reconstruction de l'interface.
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
   * Remplace l'accueil généré par ui.js
   * par le nouvel accueil.
   */
  function enhanceCurrentScreen() {
    if (!appElement) {
      return;
    }

    const page =
      appElement.querySelector(
        "main.screen-home"
      );

    if (!page) {
      return;
    }

    if (
      page.getAttribute(
        ENHANCED_ATTRIBUTE
      ) === "true"
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
        "Impossible de lire le relevé pour afficher l'accueil :",
        error
      );

      return;
    }

    const originalElements =
      collectOriginalElements(
        page
      );

    page.setAttribute(
      ENHANCED_ATTRIBUTE,
      "true"
    );

    page.classList.add(
      "helia-home-cinematic"
    );

    const background =
      createBlueprintBackground();

    const glow =
      createElement(
        "div",
        {
          className:
            "helia-home-glow",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    const shell =
      createElement(
        "div",
        {
          className:
            "helia-home-shell",
        }
      );

    const brand =
      createBrand();

    shell.append(
      brand
    );

    if (
      survey.localCount > 0
    ) {
      buildCurrentSurveyHome({
        shell,
        survey,

        openSurveyButton:
          originalElements
            .openSurveyButton,
      });
    } else {
      buildEmptyHome({
        shell,

        startButton:
          originalElements
            .startButton,
      });
    }

    shell.append(
      createBenefits()
    );

    if (
      originalElements.footer
    ) {
      originalElements.footer
        .classList.add(
          "helia-home-version"
        );

      shell.append(
        originalElements.footer
      );
    }

    page.replaceChildren(
      background,
      glow,
      shell
    );
  }

  /**
   * Recherche les boutons et le pied
   * de page déjà créés par ui.js.
   *
   * Les boutons sont déplacés,
   * pas recréés, afin de conserver
   * leurs écouteurs d'événements.
   *
   * @param {HTMLElement} page Page.
   * @returns {Object}
   */
  function collectOriginalElements(
    page
  ) {
    const buttons =
      Array.from(
        page.querySelectorAll(
          "button"
        )
      );

    return {
      openSurveyButton:
        buttons.find(
          (button) =>
            normalizeText(
              button.textContent
            ) ===
            "ouvrir le releve"
        ) ?? null,

      startButton:
        buttons.find(
          (button) =>
            normalizeText(
              button.textContent
            ) ===
            "commencer un releve"
        ) ?? null,

      footer:
        page.querySelector(
          ".application-footer"
        ),
    };
  }

  /**
   * Crée le fond architectural.
   *
   * @returns {HTMLElement}
   */
  function createBlueprintBackground() {
    const background =
      createElement(
        "div",
        {
          className:
            "helia-home-blueprint-background",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    background.innerHTML = `
      <svg
        viewBox="0 0 1200 1700"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="helia-home-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M48 0H0V48"
              fill="none"
              stroke="#179c9b"
              stroke-width="0.55"
              opacity="0.25"
            ></path>
          </pattern>

          <linearGradient
            id="helia-home-line-gradient"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="#009e99"
              stop-opacity="0.1"
            ></stop>

            <stop
              offset="55%"
              stop-color="#36d0ca"
              stop-opacity="0.7"
            ></stop>

            <stop
              offset="100%"
              stop-color="#009e99"
              stop-opacity="0.05"
            ></stop>
          </linearGradient>
        </defs>

        <rect
          width="1200"
          height="1700"
          fill="url(#helia-home-grid)"
          opacity="0.3"
        ></rect>

        <g
          fill="none"
          stroke="url(#helia-home-line-gradient)"
          stroke-width="1.3"
          opacity="0.55"
        >
          <path
            d="M-80 330 180 110 455 270 222 490Z"
          ></path>

          <path
            d="M-35 388 181 205 375 314 187 475Z"
          ></path>

          <path
            d="M10 328 175 188 354 289"
          ></path>

          <path
            d="M82 303v112l116 65"
          ></path>

          <path
            d="M159 237v122l112 65"
          ></path>

          <path
            d="M947 313 1275 190 1280 575 1014 662 947 592Z"
          ></path>

          <path
            d="M947 313 1034 382 1275 302"
          ></path>

          <path
            d="M1034 382v205"
          ></path>

          <path
            d="M1111 357v167"
          ></path>

          <path
            d="M1192 331v160"
          ></path>

          <rect
            x="1063"
            y="417"
            width="83"
            height="117"
          ></rect>

          <rect
            x="1168"
            y="384"
            width="73"
            height="111"
          ></rect>

          <path
            d="M1001 624 1165 568 1300 613"
          ></path>

          <path
            d="M30 1290 267 1094 544 1278 314 1483Z"
          ></path>

          <path
            d="M128 1220v164l185 99"
          ></path>

          <path
            d="M267 1094v182l277 2"
          ></path>

          <path
            d="M818 1195 1070 1041 1284 1178 1028 1364Z"
          ></path>

          <path
            d="M1070 1041v178l214-41"
          ></path>

          <path
            d="M818 1195v156l210 13"
          ></path>
        </g>
      </svg>
    `;

    return background;
  }

  /**
   * Crée le monogramme et le nom.
   *
   * @returns {HTMLElement}
   */
  function createBrand() {
    const brand =
      createElement(
        "header",
        {
          className:
            "helia-home-brand",

          attributes: {
            "aria-labelledby":
              "helia-home-title",
          },
        }
      );

    const logo =
      createElement(
        "div",
        {
          className:
            "helia-home-logo",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    logo.innerHTML = `
      <svg
        viewBox="0 0 190 160"
        role="img"
      >
        <defs>
          <linearGradient
            id="helia-logo-left"
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
            id="helia-logo-right"
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
            id="helia-logo-center"
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
          d="
            M83 15
            C88 7 95 5 101 15
            L158 126
            C164 138 157 148 145 148
            H120
            L72 48
            Z
          "
          fill="url(#helia-logo-right)"
        ></path>

        <path
          d="
            M83 15
            C88 7 95 5 101 15
            L113 39
            L72 121
            C65 135 58 148 42 148
            H24
            C11 148 5 137 11 125
            Z
          "
          fill="url(#helia-logo-left)"
        ></path>

        <path
          d="
            M55 148
            C69 148 74 137 80 127
            C88 114 98 111 108 118
            C113 121 117 129 120 137
            L125 148
            Z
          "
          fill="url(#helia-logo-center)"
        ></path>
      </svg>
    `;

    const suite =
      createElement(
        "p",
        {
          className:
            "helia-home-suite",

          text:
            "ATLAS",
        }
      );

    const title =
      createElement(
        "h1",
        {
          id:
            "helia-home-title",

          className:
            "helia-home-title",

          text:
            "H-ELIA",
        }
      );

    const description =
      createElement(
        "p",
        {
          className:
            "helia-home-description",

          text:
            "Évaluation des locaux par intelligence artificielle",
        }
      );

    brand.append(
      logo,
      suite,
      title,
      description
    );

    return brand;
  }

  /**
   * Construit l'accueil avec
   * un relevé existant.
   *
   * @param {Object} options Paramètres.
   */
  function buildCurrentSurveyHome({
    shell,
    survey,
    openSurveyButton,
  }) {
    const statistics =
      calculateStatistics(
        survey
      );

    const surveyCard =
      createSurveyCard({
        survey,
        statistics,
      });

    const actions =
      createElement(
        "section",
        {
          className:
            "helia-home-actions",

          attributes: {
            "aria-label":
              "Actions principales",
          },
        }
      );

    const resumeButton =
      openSurveyButton ||
      createFallbackResumeButton();

    configureActionButton({
      button:
        resumeButton,

      title:
        "Reprendre le relevé",

      description:
        "Continuer le relevé en cours",

      iconName:
        "play",

      primary:
        true,

      ariaLabel:
        `Reprendre le relevé ${survey.displayName}`,
    });

    const newSurveyButton =
      document.createElement(
        "button"
      );

    newSurveyButton.type =
      "button";

    configureActionButton({
      button:
        newSurveyButton,

      title:
        "Commencer un nouveau relevé",

      description:
        "Créer un nouveau relevé de locaux",

      iconName:
        "plus",

      primary:
        false,

      ariaLabel:
        "Commencer un nouveau relevé",
    });

    newSurveyButton.addEventListener(
      "click",
      () => {
        startNewSurvey({
          shell,
          survey,
        });
      }
    );

    actions.append(
      resumeButton,
      newSurveyButton
    );

    shell.append(
      surveyCard,
      actions
    );
  }

  /**
   * Crée la carte du relevé courant.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createSurveyCard({
    survey,
    statistics,
  }) {
    const card =
      createElement(
        "section",
        {
          className:
            "helia-home-survey-card",

          attributes: {
            "aria-labelledby":
              "helia-current-survey-title",
          },
        }
      );

    const header =
      createElement(
        "div",
        {
          className:
            "helia-home-survey-header",
        }
      );

    const icon =
      createIconContainer({
        className:
          "helia-home-survey-icon",

        iconName:
          "clipboard",
      });

    const heading =
      createElement(
        "div",
        {
          className:
            "helia-home-survey-heading",
        }
      );

    const eyebrow =
      createElement(
        "p",
        {
          className:
            "helia-home-eyebrow",

          text:
            "Relevé en cours",
        }
      );

    const name =
      createElement(
        "h2",
        {
          id:
            "helia-current-survey-title",

          className:
            "helia-home-survey-name",

          text:
            survey.displayName ||
            survey.name ||
            "Relevé en cours",
        }
      );

    const date =
      createElement(
        "p",
        {
          className:
            "helia-home-survey-date",

          text:
            createUpdatedAtText(
              survey
            ),
        }
      );

    heading.append(
      eyebrow,
      name,
      date
    );

    header.append(
      icon,
      heading
    );

    card.append(
      header,
      createRoomPreview()
    );

    const locationText =
      createLocationText(
        survey
      );

    if (locationText) {
      card.append(
        createElement(
          "p",
          {
            className:
              "helia-home-location",

            text:
              locationText,
          }
        )
      );
    }

    card.append(
      createStatistics(
        statistics
      )
    );

    return card;
  }

  /**
   * Crée l'aperçu filaire d'une pièce.
   *
   * @returns {HTMLElement}
   */
  function createRoomPreview() {
    const preview =
      createElement(
        "div",
        {
          className:
            "helia-home-room-preview",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    preview.innerHTML = `
      <svg
        viewBox="0 0 360 190"
        preserveAspectRatio="xMidYMid meet"
      >
        <g
          fill="none"
          stroke="#20b9b4"
          stroke-width="1"
          opacity="0.46"
        >
          <path
            d="M18 39 183 13 340 41 286 168 78 168Z"
          ></path>

          <path
            d="M18 39 78 168"
          ></path>

          <path
            d="M183 13 183 168"
          ></path>

          <path
            d="M340 41 286 168"
          ></path>

          <path
            d="M78 168 183 108 286 168"
          ></path>

          <rect
            x="222"
            y="55"
            width="71"
            height="77"
          ></rect>

          <path
            d="M230 63v61"
          ></path>

          <path
            d="M285 63v61"
          ></path>

          <rect
            x="74"
            y="63"
            width="55"
            height="58"
          ></rect>

          <path
            d="M101 63v58"
          ></path>

          <path
            d="M18 39 183 108 340 41"
          ></path>

          <path
            d="M42 59 183 100 317 58"
            opacity="0.55"
          ></path>

          <path
            d="M99 168 183 126 266 168"
            opacity="0.45"
          ></path>
        </g>
      </svg>
    `;

    return preview;
  }

  /**
   * Crée les trois statistiques.
   *
   * Aucun taux de complétion
   * n'est affiché.
   *
   * @param {Object} statistics Statistiques.
   * @returns {HTMLElement}
   */
  function createStatistics(
    statistics
  ) {
    const container =
      createElement(
        "div",
        {
          className:
            "helia-home-statistics",

          attributes: {
            "aria-label":
              createStatisticsAriaLabel(
                statistics
              ),
          },
        }
      );

    container.append(
      createStatistic({
        iconName:
          "rooms",

        value:
          statistics.localCount,

        label:
          statistics.localCount === 1
            ? "Local"
            : "Locaux",
      }),

      createStatistic({
        iconName:
          "types",

        value:
          statistics.typeCount,

        label:
          statistics.typeCount === 1
            ? "Type d’objet"
            : "Types d’objets",
      }),

      createStatistic({
        iconName:
          "objects",

        value:
          statistics.totalQuantity,

        label:
          statistics.totalQuantity === 1
            ? "Objet enregistré"
            : "Objets enregistrés",
      })
    );

    return container;
  }

  /**
   * Crée une statistique.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createStatistic({
    iconName,
    value,
    label,
  }) {
    const statistic =
      createElement(
        "div",
        {
          className:
            "helia-home-statistic",
        }
      );

    const icon =
      createIconContainer({
        className:
          "helia-home-statistic-icon",

        iconName,
      });

    const valueElement =
      createElement(
        "strong",
        {
          className:
            "helia-home-statistic-value",

          text:
            String(value),
        }
      );

    const labelElement =
      createElement(
        "span",
        {
          className:
            "helia-home-statistic-label",

          text:
            label,
        }
      );

    statistic.append(
      icon,
      valueElement,
      labelElement
    );

    return statistic;
  }

  /**
   * Construit l'accueil sans relevé.
   *
   * @param {Object} options Paramètres.
   */
  function buildEmptyHome({
    shell,
    startButton,
  }) {
    const card =
      createElement(
        "section",
        {
          className:
            "helia-home-empty-card",

          attributes: {
            "aria-labelledby":
              "helia-empty-title",
          },
        }
      );

    const icon =
      createIconContainer({
        className:
          "helia-home-empty-icon",

        iconName:
          "clipboard",
      });

    const title =
      createElement(
        "h2",
        {
          id:
            "helia-empty-title",

          className:
            "helia-home-empty-title",

          text:
            "Aucun relevé en cours",
        }
      );

    const description =
      createElement(
        "p",
        {
          className:
            "helia-home-empty-description",

          text:
            "Créez un relevé, identifiez son premier local, puis commencez l’inventaire avec la caméra ou l’ajout manuel.",
        }
      );

    const action =
      startButton ||
      createFallbackStartButton();

    configureActionButton({
      button:
        action,

      title:
        "Commencer un nouveau relevé",

      description:
        "Créer votre premier relevé de locaux",

      iconName:
        "plus",

      primary:
        true,

      ariaLabel:
        "Commencer un nouveau relevé",
    });

    card.append(
      icon,
      title,
      description
    );

    shell.append(
      card,
      createElement(
        "section",
        {
          className:
            "helia-home-actions",
        }
      )
    );

    shell
      .querySelector(
        ".helia-home-actions"
      )
      .append(
        action
      );
  }

  /**
   * Configure un bouton dans
   * le style de la maquette.
   *
   * @param {Object} options Paramètres.
   */
  function configureActionButton({
    button,
    title,
    description,
    iconName,
    primary,
    ariaLabel,
  }) {
    button.type =
      "button";

    button.className = [
      "button",
      "helia-home-action",

      primary
        ? "helia-home-action-primary"
        : "helia-home-action-secondary",
    ].join(" ");

    button.setAttribute(
      "aria-label",
      ariaLabel
    );

    const icon =
      createIconContainer({
        className:
          "helia-home-action-icon",

        iconName,
      });

    const copy =
      createElement(
        "span",
        {
          className:
            "helia-home-action-copy",
        }
      );

    const titleElement =
      createElement(
        "span",
        {
          className:
            "helia-home-action-title",

          text:
            title,
        }
      );

    const descriptionElement =
      createElement(
        "span",
        {
          className:
            "helia-home-action-description",

          text:
            description,
        }
      );

    copy.append(
      titleElement,
      descriptionElement
    );

    const chevron =
      createIconContainer({
        className:
          "helia-home-action-chevron",

        iconName:
          "chevron",
      });

    button.replaceChildren(
      icon,
      copy,
      chevron
    );
  }

  /**
   * Crée les trois arguments
   * situés en bas de l'accueil.
   *
   * @returns {HTMLElement}
   */
  function createBenefits() {
    const benefits =
      createElement(
        "section",
        {
          className:
            "helia-home-benefits",

          attributes: {
            "aria-label":
              "Caractéristiques de l'application",
          },
        }
      );

    benefits.append(
      createBenefit({
        iconName:
          "shield",

        title:
          "Sécurisé",

        description:
          "Données locales",
      }),

      createBenefit({
        iconName:
          "brain",

        title:
          "Intelligent",

        description:
          "IA assistée",
      }),

      createBenefit({
        iconName:
          "bolt",

        title:
          "Rapide",

        description:
          "Optimisé terrain",
      })
    );

    return benefits;
  }

  /**
   * Crée un argument du bas.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createBenefit({
    iconName,
    title,
    description,
  }) {
    const benefit =
      createElement(
        "div",
        {
          className:
            "helia-home-benefit",
        }
      );

    const icon =
      createIconContainer({
        className:
          "helia-home-benefit-icon",

        iconName,
      });

    const copy =
      createElement(
        "div",
        {
          className:
            "helia-home-benefit-copy",
        }
      );

    copy.append(
      createElement(
        "strong",
        {
          className:
            "helia-home-benefit-title",

          text:
            title,
        }
      ),

      createElement(
        "span",
        {
          className:
            "helia-home-benefit-description",

          text:
            description,
        }
      )
    );

    benefit.append(
      icon,
      copy
    );

    return benefit;
  }

  /**
   * Commence un nouveau relevé.
   *
   * @param {Object} options Paramètres.
   */
  function startNewSurvey({
    shell,
    survey,
  }) {
    removeAlert(
      shell
    );

    const confirmed =
      window.confirm(
        [
          "Commencer un nouveau relevé ?",
          "",
          `Le relevé « ${survey.displayName} », ses locaux et tous ses objets seront définitivement effacés.`,
          "",
          "Cette action est irréversible.",
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    try {
      window.HeliaCamera
        ?.stop?.();

      window.HeliaInventory
        .resetSurvey();

      window.HeliaNavigation
        .navigateTo(
          window.HELIA_SCREENS
            .LOCAL_IDENTIFICATION
        );
    } catch (error) {
      console.error(
        "Impossible de commencer un nouveau relevé :",
        error
      );

      displayAlert(
        shell,
        error?.message ||
          "Le nouveau relevé n’a pas pu être créé."
      );
    }
  }

  /**
   * Crée un bouton de secours
   * vers le récapitulatif.
   *
   * @returns {HTMLButtonElement}
   */
  function createFallbackResumeButton() {
    const button =
      document.createElement(
        "button"
      );

    button.addEventListener(
      "click",
      () => {
        window.HeliaNavigation
          .navigateTo(
            window.HELIA_SCREENS
              .SUMMARY
          );
      }
    );

    return button;
  }

  /**
   * Crée un bouton de secours
   * vers la création du premier local.
   *
   * @returns {HTMLButtonElement}
   */
  function createFallbackStartButton() {
    const button =
      document.createElement(
        "button"
      );

    button.addEventListener(
      "click",
      () => {
        window.HeliaNavigation
          .navigateTo(
            window.HELIA_SCREENS
              .LOCAL_IDENTIFICATION
          );
      }
    );

    return button;
  }

  /**
   * Calcule les statistiques globales.
   *
   * Les types sont dédupliqués
   * sans tenir compte des accents
   * ou des majuscules.
   *
   * @param {Object} survey Relevé.
   * @returns {Object}
   */
  function calculateStatistics(
    survey
  ) {
    const locals =
      Array.isArray(
        survey?.locals
      )
        ? survey.locals
        : [];

    const typeNames =
      new Set();

    let totalQuantity =
      0;

    locals.forEach(
      (local) => {
        const items =
          Array.isArray(
            local?.items
          )
            ? local.items
            : [];

        items.forEach(
          (item) => {
            const normalizedName =
              normalizeText(
                item?.label
              );

            if (normalizedName) {
              typeNames.add(
                normalizedName
              );
            }

            totalQuantity +=
              normalizeQuantity(
                item?.quantity
              );
          }
        );
      }
    );

    return {
      localCount:
        locals.length,

      typeCount:
        typeNames.size,

      totalQuantity,
    };
  }

  /**
   * Crée le texte accessible
   * des statistiques.
   *
   * @param {Object} statistics Statistiques.
   * @returns {string}
   */
  function createStatisticsAriaLabel(
    statistics
  ) {
    return [
      `${statistics.localCount} ${
        statistics.localCount === 1
          ? "local"
          : "locaux"
      }`,

      `${statistics.typeCount} ${
        statistics.typeCount === 1
          ? "type d’objet"
          : "types d’objets"
      }`,

      `${statistics.totalQuantity} ${
        statistics.totalQuantity === 1
          ? "objet enregistré"
          : "objets enregistrés"
      }`,
    ].join(", ");
  }

  /**
   * Crée la ligne de modification.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createUpdatedAtText(
    survey
  ) {
    const updatedDate =
      parseDate(
        survey.updatedAt
      );

    if (updatedDate) {
      try {
        const formatter =
          new Intl.DateTimeFormat(
            "fr-BE",
            {
              day:
                "numeric",

              month:
                "long",

              year:
                "numeric",

              hour:
                "2-digit",

              minute:
                "2-digit",
            }
          );

        return (
          "Modifié le " +
          formatter.format(
            updatedDate
          )
        );
      } catch (error) {
        console.warn(
          "Impossible de formater la date du relevé :",
          error
        );
      }
    }

    const surveyDate =
      formatSurveyDate(
        survey.surveyDate
      );

    if (surveyDate) {
      return (
        `Date du relevé : ${surveyDate}`
      );
    }

    return "Relevé enregistré sur cet appareil";
  }

  /**
   * Transforme une valeur en date valide.
   *
   * @param {unknown} value Valeur.
   * @returns {Date|null}
   */
  function parseDate(
    value
  ) {
    if (!value) {
      return null;
    }

    const date =
      new Date(
        value
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  /**
   * Formate une date YYYY-MM-DD.
   *
   * @param {unknown} value Valeur.
   * @returns {string}
   */
  function formatSurveyDate(
    value
  ) {
    const normalizedValue =
      String(
        value ?? ""
      ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        normalizedValue
      )
    ) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] =
      normalizedValue.split(
        "-"
      );

    return `${day}/${month}/${year}`;
  }

  /**
   * Crée le résumé de localisation.
   *
   * @param {Object} survey Relevé.
   * @returns {string}
   */
  function createLocationText(
    survey
  ) {
    return [
      survey.site,
      survey.building,
      survey.level,
      survey.unit,
    ]
      .map(
        (value) =>
          String(
            value ?? ""
          ).trim()
      )
      .filter(Boolean)
      .join(" · ");
  }

  /**
   * Crée un conteneur d'icône.
   *
   * @param {Object} options Paramètres.
   * @returns {HTMLElement}
   */
  function createIconContainer({
    className,
    iconName,
  }) {
    const container =
      createElement(
        "span",
        {
          className,

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    container.innerHTML =
      ICONS[iconName] ||
      "";

    return container;
  }

  /**
   * Affiche une erreur.
   *
   * @param {HTMLElement} shell Conteneur.
   * @param {string} message Message.
   */
  function displayAlert(
    shell,
    message
  ) {
    removeAlert(
      shell
    );

    const alert =
      createElement(
        "p",
        {
          className:
            "helia-home-alert",

          text:
            message,

          attributes: {
            role:
              "alert",

            [ALERT_ATTRIBUTE]:
              "true",
          },
        }
      );

    const actions =
      shell.querySelector(
        ".helia-home-actions"
      );

    if (actions) {
      actions.insertAdjacentElement(
        "afterend",
        alert
      );
    } else {
      shell.append(
        alert
      );
    }
  }

  /**
   * Supprime une ancienne erreur.
   *
   * @param {HTMLElement} shell Conteneur.
   */
  function removeAlert(
    shell
  ) {
    shell
      .querySelector(
        `[${ALERT_ATTRIBUTE}="true"]`
      )
      ?.remove();
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
   * Normalise un texte.
   *
   * @param {unknown} value Valeur.
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

    if (
      text !==
      null
    ) {
      element.textContent =
        text;
    }

    Object.entries(
      attributes
    ).forEach(
      ([name, value]) => {
        if (
          value ===
            null ||
          value ===
            undefined ||
          value ===
            false
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
   * Force une vérification.
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
  }

  /**
   * Démarrage automatique.
   */
  function startAutomatically() {
    try {
      initialize();
    } catch (error) {
      console.error(
        "Le nouvel accueil H-ELIA n'a pas pu démarrer :",
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