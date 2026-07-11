"use strict";

/**
 * Habillage immersif de l'écran de scan ATLAS H-ELIA.
 *
 * Ce module :
 * - conserve intégralement la logique de ui.js ;
 * - ne remplace ni la caméra ni la reconnaissance IA ;
 * - conserve les écouteurs des boutons existants ;
 * - transforme visuellement l'écran de scan ;
 * - harmonise l'ajout manuel et les validations ;
 * - fonctionne sur téléphone, tablette et ordinateur.
 */
window.HeliaScan = (() => {
  const APP_ELEMENT_ID =
    "app";

  const STYLE_ELEMENT_ID =
    "helia-scan-cinematic-styles";

  const ENHANCED_ATTRIBUTE =
    "data-helia-scan-enhanced";

  const BACKGROUND_ATTRIBUTE =
    "data-helia-scan-background";

  const IDENTITY_ATTRIBUTE =
    "data-helia-scan-identity";

  const MANUAL_CARD_CLASS =
    "helia-scan-manual-card";

  let appElement =
    null;

  let observer =
    null;

  let enhancementScheduled =
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

    injectStyles();

    appElement =
      document.getElementById(
        appElementId
      );

    if (!appElement) {
      console.warn(
        `L'écran de scan attend le conteneur #${appElementId}.`
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
   * Ajoute les styles de l'écran.
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
      /* =====================================================
         PAGE GÉNÉRALE
         ===================================================== */

      .screen.helia-scan-page {
        --helia-scan-background: #01161b;
        --helia-scan-background-deep: #000c10;

        --helia-scan-panel:
          rgb(4 50 58 / 86%);

        --helia-scan-panel-soft:
          rgb(4 63 71 / 58%);

        --helia-scan-border:
          rgb(57 214 207 / 31%);

        --helia-scan-border-strong:
          rgb(39 229 219 / 61%);

        --helia-scan-accent: #18d2ca;
        --helia-scan-accent-soft: #75ebe5;

        --helia-scan-text: #f2ffff;
        --helia-scan-muted: #91b8bd;

        --helia-scan-success: #55e69b;
        --helia-scan-warning: #ff9e69;
        --helia-scan-danger: #ff826f;

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
          max(
            15px,
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

        overflow: hidden;

        color:
          var(--helia-scan-text);

        background:
          radial-gradient(
            circle at 50% 3%,
            rgb(0 190 182 / 15%),
            transparent 31rem
          ),
          radial-gradient(
            circle at 0% 48%,
            rgb(0 158 153 / 7%),
            transparent 27rem
          ),
          linear-gradient(
            180deg,
            var(--helia-scan-background) 0%,
            var(--helia-scan-background-deep) 100%
          );
      }

      .helia-scan-page *,
      .helia-scan-page *::before,
      .helia-scan-page *::after {
        box-sizing: border-box;
      }

      /* =====================================================
         FOND ARCHITECTURAL
         ===================================================== */

      .helia-scan-background {
        position: absolute;
        z-index: -3;
        inset: 0;

        width: 100%;
        height: 100%;

        overflow: hidden;

        pointer-events: none;
      }

      .helia-scan-background svg {
        display: block;

        width: 100%;
        height: 100%;

        opacity: 0.25;
      }

      .helia-scan-background::after {
        position: absolute;
        inset: 0;

        background:
          linear-gradient(
            180deg,
            transparent 0%,
            transparent 43%,
            rgb(0 12 16 / 58%) 77%,
            var(--helia-scan-background-deep) 100%
          );

        content: "";
      }

      .helia-scan-glow {
        position: absolute;
        z-index: -2;
        top: -160px;
        left: 50%;

        width: min(96vw, 900px);
        height: 720px;

        border-radius: 50%;

        background:
          radial-gradient(
            circle,
            rgb(0 211 202 / 12%) 0%,
            transparent 69%
          );

        pointer-events: none;

        transform:
          translateX(-50%);
      }

      /* =====================================================
         EN-TÊTE
         ===================================================== */

      .helia-scan-page > .screen-header {
        position: relative;
        z-index: 3;

        display: grid;
        grid-template-columns:
          auto minmax(0, 1fr) auto;
        align-items: center;

        width: min(100%, 1060px);
        min-height: 52px;

        margin: 0 auto 9px;
      }

      .helia-scan-page
        .screen-header
        .button-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;

        grid-column: 1;

        width: auto;
        min-width: 44px;
        min-height: 44px;

        padding: 8px 11px;

        border:
          1px solid
          rgb(66 213 206 / 26%);

        border-radius: 12px;

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(1 30 36 / 47%);

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 3%);
      }

      .helia-scan-page
        .screen-header
        .button-icon:hover:not(:disabled) {
        border-color:
          var(--helia-scan-border-strong);

        background:
          rgb(5 57 64 / 68%);
      }

      .helia-scan-back-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .helia-scan-back-icon svg {
        width: 19px;
        height: 19px;

        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.9;
      }

      .helia-scan-page
        .screen-title {
        grid-column: 2;

        margin: 0;
        padding: 0 10px;

        color:
          rgb(230 255 255 / 78%);

        font-size:
          clamp(
            0.83rem,
            3.5vw,
            1rem
          );

        font-weight: 590;
        letter-spacing: 0.08em;
        line-height: 1.3;
        text-align: center;
        text-transform: uppercase;
      }

      /* =====================================================
         IDENTITÉ COMPACTE
         ===================================================== */

      .helia-scan-identity {
        position: relative;
        z-index: 2;

        display: grid;
        grid-template-columns:
          auto minmax(0, 1fr);
        align-items: center;
        gap: 14px;

        width: min(100%, 1060px);

        margin: 0 auto 17px;
        padding: 6px 3px 11px;
      }

      .helia-scan-logo {
        width:
          clamp(
            61px,
            16vw,
            82px
          );

        filter:
          drop-shadow(
            0 11px 22px
            rgb(0 205 196 / 18%)
          );
      }

      .helia-scan-logo svg {
        display: block;

        width: 100%;
        height: auto;
      }

      .helia-scan-brand-copy {
        min-width: 0;
      }

      .helia-scan-suite {
        margin: 0 0 3px;

        color:
          var(--helia-scan-accent-soft);

        font-size: 0.61rem;
        font-weight: 740;
        letter-spacing: 0.29em;
        line-height: 1.2;
        text-transform: uppercase;

        opacity: 0.72;
      }

      .helia-scan-brand-name {
        margin: 0;

        color:
          var(--helia-scan-text);

        font-size:
          clamp(
            1.65rem,
            7.5vw,
            2.55rem
          );

        font-weight: 410;
        letter-spacing: 0.08em;
        line-height: 1;
      }

      .helia-scan-brand-description {
        margin: 7px 0 0;

        color:
          var(--helia-scan-accent-soft);

        font-size:
          clamp(
            0.73rem,
            2.9vw,
            0.91rem
          );

        font-weight: 410;
        line-height: 1.4;

        opacity: 0.82;
      }

      /* =====================================================
         CONTENEUR DU SCAN
         ===================================================== */

      .helia-scan-page
        > .scan-content {
        position: relative;
        z-index: 1;

        display: flex;
        flex-direction: column;
        gap: 15px;

        width: min(100%, 1060px);
        min-height: 0;

        margin: 0 auto;

        padding:
          clamp(
            17px,
            4.5vw,
            27px
          );

        overflow: hidden;

        border:
          1px solid
          var(--helia-scan-border);

        border-radius: 25px;

        color:
          var(--helia-scan-text);

        background:
          linear-gradient(
            145deg,
            rgb(8 72 80 / 74%) 0%,
            rgb(2 33 39 / 92%) 100%
          );

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 5%),
          0 25px 64px
          rgb(0 0 0 / 31%);

        backdrop-filter:
          blur(18px);

        -webkit-backdrop-filter:
          blur(18px);
      }

      .helia-scan-page
        > .scan-content::before {
        position: absolute;
        top: -190px;
        right: -190px;

        width: 410px;
        height: 410px;

        border:
          60px solid
          rgb(41 220 211 / 4%);

        border-radius: 50%;

        content: "";
        pointer-events: none;
      }

      .helia-scan-page
        > .scan-content
        > * {
        position: relative;
        z-index: 1;
      }

      /* =====================================================
         LOCAL ET STATUT
         ===================================================== */

      .helia-scan-page
        .scan-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        width: 100%;
        min-width: 0;
      }

      .helia-scan-page
        .local-badge {
        display: inline-flex;
        align-items: center;

        min-width: 0;
        max-width: 70%;
        min-height: 34px;

        padding: 7px 11px;

        overflow: hidden;

        border:
          1px solid
          rgb(59 215 208 / 31%);

        border-radius: 999px;

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(0 158 153 / 9%);

        font-size: 0.7rem;
        font-weight: 720;
        letter-spacing: 0.08em;
        line-height: 1.2;

        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .helia-scan-page
        .status-pill {
        position: relative;

        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;

        flex: 0 0 auto;

        min-height: 34px;

        padding: 7px 11px;

        border-radius: 999px;

        font-size: 0.69rem;
        font-weight: 650;
        line-height: 1.2;
      }

      .helia-scan-page
        .status-pill::before {
        width: 7px;
        height: 7px;

        border-radius: 50%;

        content: "";
      }

      .helia-scan-page
        .status-pill-active {
        border:
          1px solid
          rgb(85 230 155 / 42%);

        color:
          #a5f8ca;

        background:
          rgb(85 230 155 / 9%);
      }

      .helia-scan-page
        .status-pill-active::before {
        background:
          var(--helia-scan-success);

        box-shadow:
          0 0 0 5px
          rgb(85 230 155 / 9%);

        animation:
          helia-scan-status-pulse
          1.8s ease-in-out infinite;
      }

      .helia-scan-page
        .status-pill-ready {
        border:
          1px solid
          rgb(126 189 193 / 26%);

        color:
          var(--helia-scan-muted);

        background:
          rgb(4 37 43 / 42%);
      }

      .helia-scan-page
        .status-pill-ready::before {
        background:
          rgb(128 177 181 / 66%);
      }

      .helia-scan-page
        .screen-introduction {
        margin: -3px 0 2px;

        color:
          var(--helia-scan-muted);

        font-size:
          clamp(
            0.8rem,
            3vw,
            0.92rem
          );

        font-weight: 410;
        line-height: 1.5;
        text-align: left;
      }

      /* =====================================================
         CAMÉRA
         ===================================================== */

      .helia-scan-page
        .camera-viewport {
        position: relative;

        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        min-height: 310px;
        aspect-ratio: 4 / 3;

        margin: 0;

        overflow: hidden;

        border:
          1px solid
          rgb(44 225 216 / 47%);

        border-radius: 21px;

        background:
          radial-gradient(
            circle at center,
            rgb(3 57 64 / 62%) 0%,
            rgb(0 19 24 / 94%) 74%
          );

        box-shadow:
          inset 0 0 0 1px
          rgb(255 255 255 / 3%),
          inset 0 0 50px
          rgb(0 0 0 / 34%),
          0 20px 42px
          rgb(0 0 0 / 22%);
      }

      .helia-scan-page
        .camera-viewport::before {
        position: absolute;
        z-index: 4;
        inset: 0;

        background:
          linear-gradient(
            180deg,
            rgb(15 67 73 / 7%) 0%,
            transparent 28%,
            transparent 72%,
            rgb(0 14 18 / 30%) 100%
          );

        content: "";
        pointer-events: none;
      }

      .helia-scan-page
        .camera-viewport::after {
        position: absolute;
        z-index: 5;
        top: 0;
        left: 0;

        width: 100%;
        height: 2px;

        background:
          linear-gradient(
            90deg,
            transparent,
            var(--helia-scan-accent),
            transparent
          );

        box-shadow:
          0 0 17px
          var(--helia-scan-accent);

        content: "";
        opacity: 0;
        pointer-events: none;
      }

      .helia-scan-page
        .camera-viewport.helia-camera-active::after {
        opacity: 0.67;

        animation:
          helia-scan-camera-line
          3.8s linear infinite;
      }

      .helia-scan-page
        .camera-preview {
        position: absolute;
        inset: 0;

        display: block;

        width: 100%;
        height: 100%;

        object-fit: cover;

        background:
          #001015;
      }

      .helia-scan-page
        .camera-guide {
        position: absolute;
        z-index: 6;

        top: 16%;
        right: 17%;
        bottom: 16%;
        left: 17%;

        border: 0;
        border-radius: 17px;

        background:
          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          left top / 34px 3px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          left top / 3px 34px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          right top / 34px 3px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          right top / 3px 34px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          left bottom / 34px 3px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          left bottom / 3px 34px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          right bottom / 34px 3px
          no-repeat,

          linear-gradient(
            var(--helia-scan-accent),
            var(--helia-scan-accent)
          )
          right bottom / 3px 34px
          no-repeat;

        filter:
          drop-shadow(
            0 0 6px
            rgb(24 210 202 / 58%)
          );

        pointer-events: none;
      }

      .helia-scan-page
        .camera-guide-label {
        position: absolute;
        z-index: 7;
        bottom: 16px;
        left: 50%;

        width: max-content;
        max-width: calc(100% - 32px);

        padding: 8px 12px;

        border:
          1px solid
          rgb(61 226 218 / 33%);

        border-radius: 999px;

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(0 16 20 / 71%);

        font-size: 0.72rem;
        font-weight: 520;
        line-height: 1.3;
        text-align: center;

        backdrop-filter:
          blur(8px);

        -webkit-backdrop-filter:
          blur(8px);

        transform:
          translateX(-50%);
      }

      /* =====================================================
         CAMÉRA INACTIVE
         ===================================================== */

      .helia-scan-page
        .camera-placeholder {
        position: relative;
        z-index: 2;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 9px;

        width: 100%;
        height: 100%;

        min-height: 310px;

        padding: 30px;

        color:
          var(--helia-scan-muted);

        text-align: center;
      }

      .helia-scan-page
        .camera-placeholder-symbol {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 67px;
        height: 67px;

        margin-bottom: 4px;

        border:
          1px solid
          rgb(43 220 211 / 43%);

        border-radius: 50%;

        color:
          var(--helia-scan-accent);

        background:
          rgb(0 158 153 / 8%);

        box-shadow:
          0 0 32px
          rgb(0 203 194 / 10%);

        font-size: 2rem;
        font-weight: 300;
        line-height: 1;
      }

      .helia-scan-page
        .camera-placeholder strong {
        color:
          var(--helia-scan-text);

        font-size: 1.08rem;
        font-weight: 520;
      }

      .helia-scan-page
        .camera-placeholder p {
        max-width: 330px;

        margin: 0;

        color:
          var(--helia-scan-muted);

        font-size: 0.82rem;
        line-height: 1.5;
      }

      /* =====================================================
         PANNEAU IA
         ===================================================== */

      .helia-scan-page
        .prediction-card {
        display: flex;
        flex-direction: column;
        gap: 14px;

        width: 100%;
        min-width: 0;

        padding:
          clamp(
            16px,
            4vw,
            21px
          );

        border:
          1px solid
          rgb(55 215 207 / 28%);

        border-radius: 19px;

        color:
          var(--helia-scan-text);

        background:
          linear-gradient(
            145deg,
            rgb(2 48 55 / 79%) 0%,
            rgb(1 25 31 / 87%) 100%
          );

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 4%),
          0 15px 32px
          rgb(0 0 0 / 18%);
      }

      .helia-scan-page
        .prediction-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 11px;

        width: 100%;
      }

      .helia-scan-page
        .prediction-title {
        margin: 0;

        color:
          var(--helia-scan-text);

        font-size:
          clamp(
            0.98rem,
            4vw,
            1.18rem
          );

        font-weight: 520;
        line-height: 1.3;
      }

      .helia-scan-page
        #ai-engine-status {
        min-height: 30px;

        padding: 6px 10px;

        font-size: 0.66rem;
      }

      .helia-scan-page
        .prediction-main-result {
        display: flex;
        flex-direction: column;
        gap: 6px;

        min-height: 94px;

        padding: 15px 16px;

        border:
          1px solid
          rgb(55 212 205 / 20%);

        border-radius: 15px;

        background:
          rgb(0 18 23 / 34%);
      }

      .helia-scan-page
        #ai-main-label {
        color:
          var(--helia-scan-text);

        font-size:
          clamp(
            0.95rem,
            3.8vw,
            1.12rem
          );

        font-weight: 540;
        line-height: 1.35;

        overflow-wrap: anywhere;
      }

      .helia-scan-page
        #ai-main-details {
        margin: 0;

        color:
          var(--helia-scan-muted);

        font-size: 0.78rem;
        font-weight: 410;
        line-height: 1.5;

        overflow-wrap: anywhere;
      }

      /* =====================================================
         LISTE DES PRÉDICTIONS
         ===================================================== */

      .helia-scan-page
        .prediction-list {
        display: grid;
        grid-template-columns: 1fr;
        gap: 9px;

        width: 100%;
      }

      .helia-scan-page
        .prediction-list:empty {
        display: none;
      }

      .helia-scan-page
        .prediction-row {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr) auto;
        gap: 9px 12px;

        width: 100%;
        min-width: 0;

        padding: 12px 13px;

        border:
          1px solid
          rgb(59 207 201 / 19%);

        border-radius: 13px;

        color:
          var(--helia-scan-text);

        background:
          rgb(1 28 34 / 45%);

        text-align: left;

        transition:
          border-color 150ms ease,
          background-color 150ms ease,
          transform 150ms ease;
      }

      .helia-scan-page
        button.prediction-row {
        cursor: pointer;
      }

      .helia-scan-page
        .prediction-row-selectable:hover:not(:disabled) {
        border-color:
          rgb(39 225 216 / 54%);

        background:
          rgb(3 61 67 / 67%);

        transform:
          translateY(-1px);
      }

      .helia-scan-page
        .prediction-row-selected {
        border-color:
          var(--helia-scan-accent);

        background:
          rgb(0 126 126 / 25%);

        box-shadow:
          0 0 0 3px
          rgb(24 210 202 / 8%);
      }

      .helia-scan-page
        .prediction-class-name {
        min-width: 0;

        color:
          var(--helia-scan-text);

        font-size: 0.86rem;
        font-weight: 530;
        line-height: 1.35;

        overflow-wrap: anywhere;
      }

      .helia-scan-page
        .prediction-percentage {
        color:
          var(--helia-scan-accent-soft);

        font-size: 0.82rem;
        font-weight: 570;
        line-height: 1.35;

        font-variant-numeric:
          tabular-nums;
      }

      .helia-scan-page
        .prediction-progress-track {
        grid-column: 1 / -1;

        width: 100%;
        height: 6px;

        overflow: hidden;

        border-radius: 999px;

        background:
          rgb(112 180 183 / 15%);
      }

      .helia-scan-page
        .prediction-progress-bar {
        width: 0;
        height: 100%;

        border-radius: inherit;

        background:
          linear-gradient(
            90deg,
            #009e99,
            #53e8df
          );

        box-shadow:
          0 0 10px
          rgb(24 210 202 / 30%);
      }

      .helia-scan-page
        .prediction-row-ignored {
        opacity: 0.55;
      }

      /* =====================================================
         ACTIONS IA
         ===================================================== */

      .helia-scan-page
        .prediction-actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 9px;

        width: 100%;
      }

      .helia-scan-page
        .prediction-actions:empty {
        display: none;
      }

      .helia-scan-page
        .prediction-actions
        .button {
        width: 100%;
        max-width: none;
        min-height: 48px;

        border-radius: 13px;

        font-size: 0.86rem;
        font-weight: 530;
      }

      .helia-scan-page
        .prediction-actions
        .button-primary {
        border:
          1px solid
          rgb(42 228 218 / 54%);

        color:
          var(--helia-scan-text);

        background:
          linear-gradient(
            100deg,
            rgb(0 137 138 / 95%),
            rgb(0 87 99 / 95%)
          );

        box-shadow:
          0 10px 22px
          rgb(0 124 125 / 14%);
      }

      .helia-scan-page
        .prediction-actions
        .button-secondary {
        border:
          1px solid
          rgb(60 211 204 / 28%);

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(0 24 29 / 36%);
      }

      /* =====================================================
         QUANTITÉ
         ===================================================== */

      .helia-scan-page
        .quantity-title {
        display: block;

        margin: 1px 0 3px;

        color:
          var(--helia-scan-text);

        font-size: 0.87rem;
        font-weight: 530;
        line-height: 1.4;
        text-align: center;
      }

      .helia-scan-page
        .quantity-controls {
        display: grid;
        grid-template-columns:
          52px minmax(76px, 1fr) 52px;
        align-items: center;
        gap: 9px;

        width: min(100%, 330px);

        margin: 0 auto;
      }

      .helia-scan-page
        .quantity-button {
        width: 52px;
        min-width: 52px;
        min-height: 52px;

        padding: 0;

        border:
          1px solid
          rgb(50 220 211 / 42%);

        border-radius: 13px;

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(0 27 33 / 55%);

        font-size: 1.45rem;
        font-weight: 420;
        line-height: 1;
      }

      .helia-scan-page
        .quantity-button:hover:not(:disabled) {
        border-color:
          var(--helia-scan-accent);

        background:
          rgb(4 64 70 / 67%);
      }

      .helia-scan-page
        .quantity-input {
        min-width: 0;
        min-height: 52px;

        padding: 9px 10px;

        border:
          1px solid
          rgb(52 213 206 / 31%);

        border-radius: 13px;

        color:
          var(--helia-scan-text);

        background:
          rgb(0 19 24 / 52%);

        font-size: 1.06rem;
        font-weight: 570;
        text-align: center;

        font-variant-numeric:
          tabular-nums;
      }

      /* =====================================================
         AJOUT MANUEL
         ===================================================== */

      .helia-scan-page
        .helia-scan-manual-card {
        display: flex;
        flex-direction: column;
        gap: 14px;

        width: 100%;
        min-width: 0;

        padding:
          clamp(
            16px,
            4vw,
            21px
          );

        border:
          1px solid
          rgb(74 180 233 / 29%);

        border-radius: 19px;

        color:
          var(--helia-scan-text);

        background:
          linear-gradient(
            145deg,
            rgb(4 49 61 / 77%),
            rgb(1 25 32 / 88%)
          );

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 4%),
          0 15px 30px
          rgb(0 0 0 / 17%);
      }

      .helia-scan-page
        .helia-scan-manual-card
        h2,
      .helia-scan-page
        .helia-scan-manual-card
        h3,
      .helia-scan-page
        [class*="manual"]
        h2,
      .helia-scan-page
        [class*="manual"]
        h3 {
        margin: 0;

        color:
          var(--helia-scan-text);

        font-size: 1rem;
        font-weight: 530;
        line-height: 1.35;
      }

      .helia-scan-page
        .helia-scan-manual-card
        p,
      .helia-scan-page
        [class*="manual"]
        p {
        color:
          var(--helia-scan-muted);

        font-size: 0.78rem;
        line-height: 1.5;
      }

      .helia-scan-page
        .helia-scan-manual-card
        .field-label,
      .helia-scan-page
        [class*="manual"]
        .field-label {
        color:
          rgb(232 255 255 / 86%);

        font-size: 0.8rem;
        font-weight: 550;
      }

      .helia-scan-page
        .helia-scan-manual-card
        input,
      .helia-scan-page
        .helia-scan-manual-card
        textarea,
      .helia-scan-page
        [class*="manual"]
        input,
      .helia-scan-page
        [class*="manual"]
        textarea {
        width: 100%;
        min-width: 0;
        min-height: 51px;

        padding: 12px 14px;

        border:
          1px solid
          rgb(74 193 231 / 29%);

        border-radius: 13px;

        color:
          var(--helia-scan-text);

        background:
          rgb(0 20 26 / 54%);

        caret-color:
          var(--helia-scan-accent);

        font-family: inherit;
      }

      .helia-scan-page
        .helia-scan-manual-card
        input:focus,
      .helia-scan-page
        .helia-scan-manual-card
        textarea:focus,
      .helia-scan-page
        [class*="manual"]
        input:focus,
      .helia-scan-page
        [class*="manual"]
        textarea:focus {
        border-color:
          var(--helia-scan-accent);

        box-shadow:
          0 0 0 4px
          rgb(24 210 202 / 10%);
      }

      .helia-scan-page
        .helia-scan-manual-card
        .button,
      .helia-scan-page
        [class*="manual"]
        .button {
        width: 100%;
        max-width: none;

        border-radius: 13px;
      }

      /* =====================================================
         COMPTEUR
         ===================================================== */

      .helia-scan-page
        .scan-counter {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: center;
        gap: 8px;

        min-height: 39px;

        margin: 1px auto;
        padding: 8px 14px;

        border:
          1px solid
          rgb(57 215 208 / 30%);

        border-radius: 999px;

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(0 158 153 / 8%);

        font-size: 0.79rem;
        font-weight: 550;
        line-height: 1.3;

        box-shadow:
          0 0 22px
          rgb(0 196 188 / 7%);
      }

      .helia-scan-page
        .scan-counter::before {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 20px;
        height: 20px;

        border:
          1px solid
          rgb(72 227 219 / 38%);

        border-radius: 50%;

        color:
          var(--helia-scan-accent);

        content: "✓";

        font-size: 0.66rem;
        font-weight: 800;
      }

      /* =====================================================
         ALERTES
         ===================================================== */

      .helia-scan-page
        .inline-alert {
        width: 100%;

        padding: 13px 15px;

        border:
          1px solid
          rgb(255 158 105 / 57%);

        border-left-width: 4px;
        border-radius: 13px;

        color:
          #ffe0cf;

        background:
          rgb(225 96 33 / 11%);

        font-size: 0.82rem;
        font-weight: 500;
        line-height: 1.5;
      }

      /* =====================================================
         ACTIONS DU BAS
         ===================================================== */

      .helia-scan-page
        > .scan-content
        > .button {
        width: 100%;
        max-width: none;
        min-height: 57px;

        border-radius: 15px;

        font-size: 0.94rem;
        font-weight: 550;
      }

      .helia-scan-page
        > .scan-content
        > .button-primary {
        border:
          1px solid
          rgb(40 228 218 / 59%);

        color:
          var(--helia-scan-text);

        background:
          linear-gradient(
            100deg,
            rgb(0 141 141 / 97%) 0%,
            rgb(0 89 101 / 96%) 100%
          );

        box-shadow:
          inset 0 1px 0
          rgb(255 255 255 / 8%),
          0 15px 32px
          rgb(0 121 122 / 18%);
      }

      .helia-scan-page
        > .scan-content
        > .button-primary:hover:not(:disabled) {
        border-color:
          var(--helia-scan-accent);

        background:
          linear-gradient(
            100deg,
            rgb(0 158 155 / 98%) 0%,
            rgb(0 106 115 / 98%) 100%
          );

        transform:
          translateY(-1px);
      }

      .helia-scan-page
        > .scan-content
        > .button-secondary {
        border:
          1px solid
          rgb(60 210 203 / 28%);

        color:
          var(--helia-scan-accent-soft);

        background:
          rgb(1 27 33 / 48%);
      }

      .helia-scan-page
        > .scan-content
        > .button-secondary:hover:not(:disabled) {
        border-color:
          rgb(43 225 216 / 53%);

        background:
          rgb(4 54 61 / 63%);
      }

      .helia-scan-page
        .button-loading {
        color:
          transparent !important;

        position: relative;
      }

      .helia-scan-page
        .button-loading::after {
        position: absolute;
        top: 50%;
        left: 50%;

        width: 22px;
        height: 22px;

        margin:
          -11px 0 0 -11px;

        border:
          3px solid
          rgb(255 255 255 / 28%);

        border-top-color:
          #ffffff;

        border-radius: 50%;

        content: "";

        animation:
          helia-scan-spinner
          750ms linear infinite;
      }

      /* =====================================================
         TABLETTES ET ORDINATEURS
         ===================================================== */

      @media (min-width: 820px) {
        .screen.helia-scan-page {
          padding-top:
            max(
              25px,
              env(safe-area-inset-top)
            );

          padding-bottom:
            max(
              44px,
              env(safe-area-inset-bottom)
            );
        }

        .helia-scan-identity {
          grid-template-columns:
            82px minmax(0, 1fr);

          gap: 19px;

          margin-bottom: 20px;
        }

        .helia-scan-page
          > .scan-content {
          display: grid;
          grid-template-columns:
            minmax(0, 1.28fr)
            minmax(320px, 0.72fr);
          align-items: start;
          gap: 16px 19px;

          padding: 27px;
        }

        .helia-scan-page
          .scan-status-row,
        .helia-scan-page
          > .scan-content
          > .screen-introduction {
          grid-column: 1 / -1;
        }

        .helia-scan-page
          .camera-viewport {
          grid-column: 1;
          grid-row: 3 / span 8;

          min-height: 500px;
          aspect-ratio: auto;

          align-self: stretch;
        }

        .helia-scan-page
          #ai-prediction-panel {
          grid-column: 2;
        }

        .helia-scan-page
          .helia-scan-manual-card {
          grid-column: 2;
        }

        .helia-scan-page
          .scan-counter {
          grid-column: 2;

          width: 100%;

          margin: 0;
        }

        .helia-scan-page
          .inline-alert,
        .helia-scan-page
          > .scan-content
          > .button {
          grid-column: 1 / -1;
        }

        .helia-scan-page
          > .scan-content
          > .button {
          justify-self: stretch;
        }

        .helia-scan-page
          .prediction-list {
          grid-template-columns: 1fr;
        }
      }

      /* =====================================================
         GRANDS ÉCRANS
         ===================================================== */

      @media (min-width: 1120px) {
        .helia-scan-page
          .camera-viewport {
          min-height: 560px;
        }

        .helia-scan-page
          > .scan-content {
          padding: 30px;
        }
      }

      /* =====================================================
         PETITS ÉCRANS
         ===================================================== */

      @media (max-width: 390px) {
        .helia-scan-page
          .screen-header
          .button-icon {
          width: 44px;
          min-width: 44px;

          padding: 8px;
        }

        .helia-scan-back-label {
          display: none;
        }

        .helia-scan-identity {
          grid-template-columns:
            58px minmax(0, 1fr);

          gap: 11px;

          margin-bottom: 13px;
        }

        .helia-scan-page
          > .scan-content {
          padding: 15px;

          border-radius: 20px;
        }

        .helia-scan-page
          .camera-viewport,
        .helia-scan-page
          .camera-placeholder {
          min-height: 270px;
        }

        .helia-scan-page
          .camera-guide {
          top: 17%;
          right: 13%;
          bottom: 17%;
          left: 13%;
        }

        .helia-scan-page
          .local-badge {
          max-width: 62%;
        }

        .helia-scan-page
          .status-pill {
          padding-right: 9px;
          padding-left: 9px;
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
        .helia-scan-identity {
          margin-bottom: 10px;
        }

        .helia-scan-logo {
          width: 55px;
        }

        .helia-scan-brand-name {
          font-size: 1.55rem;
        }

        .helia-scan-page
          .camera-viewport {
          min-height: 270px;
          aspect-ratio: 16 / 9;
        }

        .helia-scan-page
          .camera-guide {
          top: 12%;
          right: 25%;
          bottom: 12%;
          left: 25%;
        }
      }

      /* =====================================================
         APPAREILS TACTILES
         ===================================================== */

      @media (hover: none) {
        .helia-scan-page
          .screen-header
          .button-icon:hover:not(:disabled) {
          border-color:
            rgb(66 213 206 / 26%);

          background:
            rgb(1 30 36 / 47%);
        }

        .helia-scan-page
          > .scan-content
          > .button-primary:hover:not(:disabled) {
          border-color:
            rgb(40 228 218 / 59%);

          background:
            linear-gradient(
              100deg,
              rgb(0 141 141 / 97%) 0%,
              rgb(0 89 101 / 96%) 100%
            );

          transform: none;
        }

        .helia-scan-page
          > .scan-content
          > .button-secondary:hover:not(:disabled) {
          border-color:
            rgb(60 210 203 / 28%);

          background:
            rgb(1 27 33 / 48%);
        }

        .helia-scan-page
          .prediction-row-selectable:hover:not(:disabled) {
          border-color:
            rgb(59 207 201 / 19%);

          background:
            rgb(1 28 34 / 45%);

          transform: none;
        }
      }

      /* =====================================================
         ANIMATIONS
         ===================================================== */

      @keyframes helia-scan-status-pulse {
        0%,
        100% {
          box-shadow:
            0 0 0 4px
            rgb(85 230 155 / 8%);
        }

        50% {
          box-shadow:
            0 0 0 8px
            rgb(85 230 155 / 2%);
        }
      }

      @keyframes helia-scan-camera-line {
        0% {
          top: 0;
        }

        50% {
          top: calc(100% - 2px);
        }

        100% {
          top: 0;
        }
      }

      @keyframes helia-scan-spinner {
        to {
          transform:
            rotate(360deg);
        }
      }

      /* =====================================================
         MOUVEMENTS RÉDUITS
         ===================================================== */

      @media (
        prefers-reduced-motion:
        reduce
      ) {
        .helia-scan-page
          .status-pill-active::before,
        .helia-scan-page
          .camera-viewport::after,
        .helia-scan-page
          .button-loading::after {
          animation: none;
        }

        .helia-scan-page
          .prediction-row,
        .helia-scan-page
          > .scan-content
          > .button {
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
   * Recherche et transforme
   * l'écran de scan affiché.
   */
  function enhanceCurrentScreen() {
    if (!appElement) {
      return;
    }

    const predictionPanel =
      appElement.querySelector(
        "#ai-prediction-panel"
      );

    const page =
      predictionPanel?.closest(
        "main.screen"
      );

    if (!page) {
      return;
    }

    if (
      page.getAttribute(
        ENHANCED_ATTRIBUTE
      ) !== "true"
    ) {
      page.setAttribute(
        ENHANCED_ATTRIBUTE,
        "true"
      );

      page.classList.add(
        "helia-scan-page"
      );

      insertBackground(
        page
      );

      prepareHeader(
        page
      );

      insertIdentity(
        page
      );
    }

    decorateDynamicElements(
      page
    );
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
            "helia-scan-background",

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
        viewBox="0 0 1200 1900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="helia-scan-grid"
            width="47"
            height="47"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M47 0H0V47"
              fill="none"
              stroke="#169c9a"
              stroke-width="0.55"
              opacity="0.23"
            ></path>
          </pattern>

          <linearGradient
            id="helia-scan-lines"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="#009e99"
              stop-opacity="0.07"
            ></stop>

            <stop
              offset="52%"
              stop-color="#35d2cb"
              stop-opacity="0.62"
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
          height="1900"
          fill="url(#helia-scan-grid)"
          opacity="0.33"
        ></rect>

        <g
          fill="none"
          stroke="url(#helia-scan-lines)"
          stroke-width="1.2"
          opacity="0.5"
        >
          <path
            d="M-80 270 184 80 469 256 220 475Z"
          ></path>

          <path
            d="M-5 334 184 196 385 315 201 474Z"
          ></path>

          <path
            d="M68 281v130l133 73"
          ></path>

          <path
            d="M177 201v141l136 77"
          ></path>

          <path
            d="M933 229 1280 101 1290 525 998 623 933 557Z"
          ></path>

          <path
            d="M933 229 1021 304 1280 219"
          ></path>

          <path
            d="M1021 304v230"
          ></path>

          <path
            d="M1110 274v191"
          ></path>

          <path
            d="M1197 244v181"
          ></path>

          <rect
            x="1053"
            y="345"
            width="87"
            height="129"
          ></rect>

          <rect
            x="1164"
            y="309"
            width="78"
            height="123"
          ></rect>

          <path
            d="M-31 1381 260 1154 595 1353 316 1601Z"
          ></path>

          <path
            d="M103 1268v214l213 119"
          ></path>

          <path
            d="M260 1154v222l335-23"
          ></path>

          <path
            d="M773 1333 1056 1149 1322 1307 1020 1547Z"
          ></path>

          <path
            d="M1056 1149v228l266-70"
          ></path>

          <path
            d="M773 1333v193l247 21"
          ></path>
        </g>
      </svg>
    `;

    const glow =
      createElement(
        "div",
        {
          className:
            "helia-scan-glow",

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
   * Le bouton lui-même est conservé :
   * son écouteur reste donc actif.
   *
   * @param {HTMLElement} page Page.
   */
  function prepareHeader(
    page
  ) {
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

    const backButton =
      header?.querySelector(
        ":scope > button"
      );

    if (!backButton) {
      return;
    }

    const icon =
      createElement(
        "span",
        {
          className:
            "helia-scan-back-icon",

          attributes: {
            "aria-hidden":
              "true",
          },
        }
      );

    icon.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        focusable="false"
      >
        <path d="m14.5 5-7 7 7 7"></path>
      </svg>
    `;

    const label =
      createElement(
        "span",
        {
          className:
            "helia-scan-back-label",

          text:
            "Retour",
        }
      );

    backButton.replaceChildren(
      icon,
      label
    );
  }

  /**
   * Ajoute l'identité compacte.
   *
   * @param {HTMLElement} page Page.
   */
  function insertIdentity(
    page
  ) {
    if (
      page.querySelector(
        `:scope > [${IDENTITY_ATTRIBUTE}="true"]`
      )
    ) {
      return;
    }

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

    if (!header) {
      return;
    }

    const identity =
      createElement(
        "section",
        {
          className:
            "helia-scan-identity",

          attributes: {
            [IDENTITY_ATTRIBUTE]:
              "true",

            "aria-label":
              "ATLAS H-ELIA, scan intelligent du local",
          },
        }
      );

    const logo =
      createElement(
        "div",
        {
          className:
            "helia-scan-logo",

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
            id="helia-scan-logo-left"
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
            id="helia-scan-logo-right"
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
            id="helia-scan-logo-center"
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
          fill="url(#helia-scan-logo-right)"
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
          fill="url(#helia-scan-logo-left)"
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
          fill="url(#helia-scan-logo-center)"
        ></path>
      </svg>
    `;

    const copy =
      createElement(
        "div",
        {
          className:
            "helia-scan-brand-copy",
        }
      );

    copy.append(
      createElement(
        "p",
        {
          className:
            "helia-scan-suite",

          text:
            "ATLAS",
        }
      ),

      createElement(
        "p",
        {
          className:
            "helia-scan-brand-name",

          text:
            "H-ELIA",
        }
      ),

      createElement(
        "p",
        {
          className:
            "helia-scan-brand-description",

          text:
            "Scan intelligent et validation des objets",
        }
      )
    );

    identity.append(
      logo,
      copy
    );

    header.insertAdjacentElement(
      "afterend",
      identity
    );
  }

  /**
   * Applique les classes qui peuvent
   * évoluer pendant le scan.
   *
   * @param {HTMLElement} page Page.
   */
  function decorateDynamicElements(
    page
  ) {
    const viewport =
      page.querySelector(
        ".camera-viewport"
      );

    if (viewport) {
      viewport.classList.toggle(
        "helia-camera-active",
        Boolean(
          viewport.querySelector(
            "video"
          )
        )
      );
    }

    decorateManualCards(
      page
    );

    decorateMainActions(
      page
    );
  }

  /**
   * Recherche la carte injectée
   * par le module d'ajout manuel.
   *
   * @param {HTMLElement} page Page.
   */
  function decorateManualCards(
    page
  ) {
    const content =
      page.querySelector(
        ":scope > .scan-content"
      );

    if (!content) {
      return;
    }

    const candidates =
      content.querySelectorAll(
        "section, article, div"
      );

    candidates.forEach(
      (candidate) => {
        if (
          candidate.id ===
          "ai-prediction-panel"
        ) {
          return;
        }

        const normalizedText =
          normalizeText(
            candidate.textContent
          );

        if (
          !normalizedText.includes(
            "ajout manuel"
          )
        ) {
          return;
        }

        let directChild =
          candidate;

        while (
          directChild.parentElement &&
          directChild.parentElement !==
            content
        ) {
          directChild =
            directChild.parentElement;
        }

        if (
          directChild.parentElement !==
          content
        ) {
          return;
        }

        if (
          directChild.classList.contains(
            "scan-status-row"
          ) ||
          directChild.classList.contains(
            "camera-viewport"
          ) ||
          directChild.id ===
            "ai-prediction-panel"
        ) {
          return;
        }

        directChild.classList.add(
          MANUAL_CARD_CLASS
        );
      }
    );
  }

  /**
   * Identifie les deux actions principales.
   *
   * @param {HTMLElement} page Page.
   */
  function decorateMainActions(
    page
  ) {
    const content =
      page.querySelector(
        ":scope > .scan-content"
      );

    if (!content) {
      return;
    }

    Array.from(
      content.children
    ).forEach(
      (element) => {
        if (
          !(element instanceof
            HTMLButtonElement)
        ) {
          return;
        }

        if (
          element.classList.contains(
            "button-primary"
          )
        ) {
          element.classList.add(
            "helia-scan-main-action"
          );
        }

        if (
          element.classList.contains(
            "button-secondary"
          )
        ) {
          element.classList.add(
            "helia-scan-secondary-action"
          );
        }
      }
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
        "L'écran de scan H-ELIA n'a pas pu démarrer :",
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