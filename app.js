"use strict";

/**
 * Interface d'ATLAS H-ELIA — contrôle des hydrants.
 *
 * Parcours :
 *   Accueil → Scan du QR code → Formulaire → Confirmation
 *   Accueil → Liste des contrôles → Export CSV
 *
 * La navigation s'appuie sur l'historique du navigateur :
 * le bouton « retour » d'Android ramène à l'écran précédent.
 */
window.HeliaApp = (() => {
  const CONFIG = window.HELIA_CONFIG;
  const Store = window.HeliaStore;

  const SCREENS = Object.freeze({
    HOME: "home",
    SCAN: "scan",
    FORM: "form",
    SAVED: "saved",
    LIST: "list",
  });

  let root = null;
  let current = { screen: SCREENS.HOME, params: {} };
  let cleanup = null;
  let formIsDirty = false;
  let toastTimer = null;

  /* =========================================================
     ICÔNES
     ========================================================= */

  const ICONS = {
    qr: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M16 16h2v2"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    torch: '<svg viewBox="0 0 24 24"><path d="M8 3h8l-1 6H9z"/><path d="M9 9h6v4l-1 8h-4l-1-8z"/><path d="M12 13v3"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2h.01"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    hydrant: '<svg viewBox="0 0 24 24"><path d="M8 21h8M9 21V10h6v11"/><path d="M8 10h8M9 10a3 3 0 016 0"/><path d="M12 4v3M6.5 13H9M15 13h2.5"/><circle cx="12" cy="14.5" r="1.3"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M4 16a8 8 0 1116 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.2"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>',
    database: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg>',
  };

  const LOGO = `
    <svg viewBox="0 0 190 160" aria-hidden="true">
      <defs>
        <linearGradient id="logo-left" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#18c7b0"/><stop offset="100%" stop-color="#65e4cf"/>
        </linearGradient>
        <linearGradient id="logo-right" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1bbbd0"/><stop offset="100%" stop-color="#006c76"/>
        </linearGradient>
        <linearGradient id="logo-center" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00686d"/><stop offset="100%" stop-color="#01484f"/>
        </linearGradient>
      </defs>
      <path d="M83 15C88 7 95 5 101 15L158 126C164 138 157 148 145 148H120L72 48Z" fill="url(#logo-right)"/>
      <path d="M83 15C88 7 95 5 101 15L113 39L72 121C65 135 58 148 42 148H24C11 148 5 137 11 125Z" fill="url(#logo-left)"/>
      <path d="M55 148C69 148 74 137 80 127C88 114 98 111 108 118C113 121 117 129 120 137L125 148Z" fill="url(#logo-center)"/>
    </svg>`;

  /* =========================================================
     OUTILS DOM
     ========================================================= */

  /**
   * Crée un élément.
   * Les textes passent toujours par textContent :
   * aucune donnée saisie n'est interprétée comme du HTML.
   */
  function h(tag, options = {}, children = []) {
    const element = document.createElement(tag);
    const { className, text, attrs, on, html } = options;

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    if (html !== undefined) element.innerHTML = html; // réservé aux icônes internes

    if (attrs) {
      Object.entries(attrs).forEach(([name, value]) => {
        if (value === false || value === null || value === undefined) return;
        if (value === true) element.setAttribute(name, "");
        else element.setAttribute(name, String(value));
      });
    }

    if (on) {
      Object.entries(on).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
      });
    }

    (Array.isArray(children) ? children : [children])
      .filter(Boolean)
      .forEach((child) => element.append(child));

    return element;
  }

  function icon(name, className = "icon") {
    return h("span", { className, html: ICONS[name], attrs: { "aria-hidden": "true" } });
  }

  function button({ label, iconName, variant = "primary", onClick, attrs }) {
    return h(
      "button",
      {
        className: `btn btn-${variant}`,
        attrs: { type: "button", ...attrs },
        on: { click: onClick },
      },
      [iconName ? icon(iconName) : null, h("span", { text: label })]
    );
  }

  function backgroundLayer() {
    const layer = h("div", { className: "bg-layer", attrs: { "aria-hidden": "true" } });

    layer.innerHTML = `
      <svg viewBox="0 0 1200 1700" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="bg-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#179c9b" stroke-width="0.55" opacity="0.25"/>
          </pattern>
          <linearGradient id="bg-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#009e99" stop-opacity="0.1"/>
            <stop offset="55%" stop-color="#36d0ca" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="#009e99" stop-opacity="0.05"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="1700" fill="url(#bg-grid)" opacity="0.3"/>
        <g fill="none" stroke="url(#bg-line)" stroke-width="1.3" opacity="0.55">
          <path d="M-80 330 180 110 455 270 222 490Z"/>
          <path d="M-35 388 181 205 375 314 187 475Z"/>
          <path d="M82 303v112l116 65M159 237v122l112 65"/>
          <path d="M947 313 1275 190 1280 575 1014 662 947 592Z"/>
          <path d="M947 313 1034 382 1275 302M1034 382v205M1111 357v167"/>
          <path d="M30 1290 267 1094 544 1278 314 1483Z"/>
          <path d="M128 1220v164l185 99M267 1094v182l277 2"/>
          <path d="M818 1195 1070 1041 1284 1178 1028 1364Z"/>
          <path d="M1070 1041v178l214-41M818 1195v156l210 13"/>
        </g>
      </svg>`;

    return layer;
  }

  function screenShell(name, children) {
    return h("main", { className: `screen screen-${name}` }, [
      backgroundLayer(),
      h("div", { className: "glow", attrs: { "aria-hidden": "true" } }),
      h("div", { className: "shell" }, children),
    ]);
  }

  function topBar(title, { onBack, subtitle } = {}) {
    return h("header", { className: "topbar" }, [
      h(
        "button",
        {
          className: "icon-btn",
          attrs: { type: "button", "aria-label": "Retour" },
          on: { click: onBack ?? (() => goBack()) },
        },
        icon("back")
      ),
      h("div", { className: "topbar-text" }, [
        h("p", { className: "eyebrow", text: subtitle ?? "ATLAS H-ELIA" }),
        h("h1", { className: "topbar-title", text: title }),
      ]),
    ]);
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function navigate(screen, params = {}, { replace = false } = {}) {
    const state = { screen, params };

    if (replace) {
      window.history.replaceState(state, "");
    } else {
      window.history.pushState(state, "");
    }

    render(state);
  }

  function goBack() {
    if (window.history.state?.screen && window.history.state.screen !== SCREENS.HOME) {
      window.history.back();
    } else {
      navigate(SCREENS.HOME, {}, { replace: true });
    }
  }

  function goHome() {
    navigate(SCREENS.HOME, {}, { replace: true });
  }

  function onPopState(event) {
    const state = event.state?.screen ? event.state : { screen: SCREENS.HOME, params: {} };

    if (current.screen === SCREENS.FORM && formIsDirty) {
      // Retour arrière pendant une saisie non enregistrée.
      window.history.pushState(current, "");

      confirmDialog({
        title: "Abandonner la saisie ?",
        message: "Le contrôle en cours n'a pas été enregistré.",
        confirmLabel: "Abandonner",
        danger: true,
      }).then((confirmed) => {
        if (confirmed) {
          formIsDirty = false;
          window.history.back();
        }
      });
      return;
    }

    render(state);
  }

  function render(state) {
    if (typeof cleanup === "function") {
      try {
        cleanup();
      } catch (error) {
        console.warn(error);
      }
    }

    cleanup = null;
    formIsDirty = false;
    current = { screen: state.screen, params: state.params ?? {} };

    const builders = {
      [SCREENS.HOME]: renderHome,
      [SCREENS.SCAN]: renderScan,
      [SCREENS.FORM]: renderForm,
      [SCREENS.SAVED]: renderSaved,
      [SCREENS.LIST]: renderList,
    };

    const build = builders[current.screen] ?? renderHome;
    const view = build(current.params);

    root.replaceChildren(view);
    window.scrollTo(0, 0);

    const heading = view.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  /* =========================================================
     ÉCRAN : ACCUEIL
     ========================================================= */

  function renderHome() {
    const controls = Store.getAll();
    const stats = computeStats(controls);

    const brand = h("header", { className: "brand" }, [
      h("div", { className: "brand-logo", html: LOGO }),
      h("p", { className: "brand-suite", text: CONFIG.application.suiteName }),
      h("h1", { className: "brand-title", text: CONFIG.application.name }),
      h("p", { className: "brand-description", text: CONFIG.application.description }),
    ]);

    const startButton = button({
      label: "Commencer",
      iconName: "qr",
      variant: "hero",
      onClick: () => navigate(SCREENS.SCAN),
    });

    const card = h("section", { className: "card home-card", attrs: { "aria-label": "Contrôles enregistrés" } }, [
      h("div", { className: "card-head" }, [
        h("span", { className: "badge-icon" }, icon("hydrant")),
        h("div", {}, [
          h("p", { className: "eyebrow", text: `Liste ${CONFIG.sharePoint.listName}` }),
          h("h2", {
            className: "card-title",
            text: controls.length
              ? `${controls.length} contrôle${controls.length > 1 ? "s" : ""} à exporter`
              : "Aucun contrôle enregistré",
          }),
        ]),
      ]),
      h("div", { className: "stats" }, [
        stat(String(stats.total), "Contrôles"),
        stat(String(stats.notOk), "Statut ≠ OK", stats.notOk ? "warn" : ""),
        stat(String(stats.hpOverdue), "Test HP > 5 ans", stats.hpOverdue ? "danger" : ""),
      ]),
      controls.length
        ? button({
            label: "Voir et exporter la liste",
            iconName: "list",
            variant: "ghost",
            onClick: () => navigate(SCREENS.LIST),
          })
        : h("p", {
            className: "muted small",
            text: "Scannez le QR code d'un hydrant pour enregistrer votre premier contrôle.",
          }),
    ]);

    const footer = h("p", {
      className: "footer",
      text: `${CONFIG.organisation.name} · ${CONFIG.application.fullName} v${CONFIG.application.version}`,
    });

    const storage = Store.getStatus();
    const storageWarning = storage.storageAvailable
      ? null
      : h("p", {
          className: "alert alert-danger",
          text: "Le stockage du téléphone est indisponible (navigation privée ?) : les contrôles ne seront pas conservés.",
        });

    return screenShell("home", [
      brand,
      storageWarning,
      h("div", { className: "hero-action" }, startButton),
      card,
      referenceCard(),
      footer,
    ]);
  }

  /**
   * Carte d'import de l'export CSV de la liste SharePoint.
   * Le référentiel sert à connaître la date du dernier test HP
   * de chaque hydrant ; il n'est pas affiché dans la liste.
   */
  function referenceCard() {
    const summary = window.HeliaReference.getSummary();

    const fileInput = h("input", {
      attrs: { type: "file", accept: ".csv,text/csv", hidden: true },
      on: {
        change: async () => {
          const file = fileInput.files?.[0];
          fileInput.value = "";
          if (!file) return;

          try {
            const text = await readFileText(file);
            const result = window.HeliaReference.importCsv(text, file.name);
            showToast(`${result.count} hydrant${result.count > 1 ? "s" : ""} chargé${result.count > 1 ? "s" : ""}.`);
            render(current);
          } catch (error) {
            console.error(error);
            showToast(error.message || "Import impossible.", "danger");
          }
        },
      },
    });

    const importedDate = summary.importedAt
      ? new Date(summary.importedAt).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })
      : "";

    return h("section", { className: "card card-compact reference-card", attrs: { "aria-label": "Référentiel SharePoint" } }, [
      h("div", { className: "card-head" }, [
        h("span", { className: "badge-icon badge-icon-sm" }, icon("database")),
        h("div", { className: "grow" }, [
          h("p", { className: "eyebrow", text: "Référentiel SharePoint" }),
          h("p", {
            className: "reference-summary",
            text: summary.loaded
              ? `${summary.count} hydrant${summary.count > 1 ? "s" : ""} · ${summary.overdue} avec test HP > ${CONFIG.hpTestMaxAgeYears} ans`
              : "Aucun export chargé",
          }),
          summary.loaded
            ? h("p", { className: "help", text: `Chargé le ${importedDate}${summary.fileName ? ` · ${summary.fileName}` : ""}` })
            : h("p", { className: "help", text: "Chargez l'export CSV de la liste pour connaître les tests HP à réaliser." }),
        ]),
      ]),
      fileInput,
      button({
        label: summary.loaded ? "Mettre à jour l'export" : "Charger un export SharePoint",
        iconName: "upload",
        variant: "ghost",
        onClick: () => fileInput.click(),
      }),
    ]);
  }

  /**
   * Lit un fichier texte en UTF-8, avec repli Windows-1252
   * si le fichier a été enregistré par Excel en ANSI.
   */
  async function readFileText(file) {
    const buffer = await file.arrayBuffer();

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("windows-1252").decode(buffer);
    }
  }

  function stat(value, label, tone = "") {
    return h("div", { className: `stat ${tone ? `stat-${tone}` : ""}` }, [
      h("strong", { className: "stat-value", text: value }),
      h("span", { className: "stat-label", text: label }),
    ]);
  }

  function computeStats(controls) {
    return {
      total: controls.length,
      notOk: controls.filter((c) => c.status && c.status !== "OK").length,
      hpOverdue: controls.filter(
        (c) => Store.getHpTestState(c.lastHpTestDate).state === "overdue"
      ).length,
    };
  }

  /* =========================================================
     ÉCRAN : SCAN
     ========================================================= */

  function renderScan() {
    const video = h("video", {
      className: "scan-video",
      attrs: { autoplay: true, muted: true, playsinline: true, "aria-hidden": "true" },
    });

    const status = h("p", {
      className: "scan-status",
      attrs: { role: "status", "aria-live": "polite" },
      text: "Démarrage de la caméra…",
    });

    const torchButton = h(
      "button",
      {
        className: "icon-btn torch-btn",
        attrs: { type: "button", "aria-label": "Lampe torche", "aria-pressed": "false", hidden: true },
        on: {
          click: async () => {
            const on = await window.HeliaScanner.toggleTorch();
            torchButton.setAttribute("aria-pressed", String(on));
          },
        },
      },
      icon("torch")
    );

    const viewport = h("div", { className: "scan-viewport is-loading" }, [
      video,
      h("div", { className: "scan-frame", attrs: { "aria-hidden": "true" } }, [
        h("span", { className: "corner tl" }),
        h("span", { className: "corner tr" }),
        h("span", { className: "corner bl" }),
        h("span", { className: "corner br" }),
        h("span", { className: "scan-line" }),
      ]),
      torchButton,
    ]);

    const errorBox = h("div", { className: "alert alert-danger", attrs: { hidden: true, role: "alert" } });

    // Saisie manuelle si le QR code est illisible.
    const manualInput = h("input", {
      className: "input",
      attrs: {
        id: "manual-code",
        type: "text",
        autocomplete: "off",
        autocapitalize: "characters",
        spellcheck: "false",
        placeholder: "ex. CHJ/D/01/14/HYD02",
        enterkeyhint: "go",
      },
    });

    const manualForm = h(
      "form",
      {
        className: "manual-form",
        attrs: { hidden: true, novalidate: true },
        on: {
          submit: (event) => {
            event.preventDefault();
            const value = manualInput.value.trim();

            if (!value) {
              manualInput.focus();
              manualInput.classList.add("has-error");
              return;
            }

            openForm(value);
          },
        },
      },
      [
        h("label", { className: "label", attrs: { for: "manual-code" }, text: "Code de l'hydrant" }),
        h("div", { className: "inline-field" }, [
          manualInput,
          h("button", { className: "btn btn-primary", attrs: { type: "submit" }, text: "Valider" }),
        ]),
      ]
    );

    const manualToggle = button({
      label: "Saisir le code manuellement",
      iconName: "keyboard",
      variant: "ghost",
      onClick: () => {
        manualForm.hidden = false;
        manualToggle.hidden = true;
        manualInput.focus();
      },
    });

    const view = screenShell("scan", [
      topBar("Scanner un hydrant", { subtitle: "Étape 1 sur 2" }),
      viewport,
      status,
      errorBox,
      h("section", { className: "card card-compact" }, [manualToggle, manualForm]),
    ]);

    let active = true;

    function openForm(value) {
      active = false;
      window.HeliaScanner.stop();
      navigate(SCREENS.FORM, { title: value }, { replace: true });
    }

    window.HeliaScanner.start(video, (value) => {
      if (!active) return;
      viewport.classList.add("is-found");
      status.textContent = `QR code détecté : ${value}`;
      window.setTimeout(() => active && openForm(value), 350);
    })
      .then(() => {
        if (!active) return;
        viewport.classList.remove("is-loading");
        status.textContent = "Placez le QR code de l'hydrant dans le cadre.";
        torchButton.hidden = !window.HeliaScanner.hasTorch();
      })
      .catch((error) => {
        if (!active) return;
        viewport.classList.remove("is-loading");
        viewport.classList.add("is-error");
        status.textContent = "";
        errorBox.hidden = false;
        errorBox.textContent = `${error.message} Vous pouvez saisir le code manuellement.`;
        manualForm.hidden = false;
        manualToggle.hidden = true;
      });

    cleanup = () => {
      active = false;
      window.HeliaScanner.stop();
    };

    return view;
  }

  /* =========================================================
     ÉCRAN : FORMULAIRE
     ========================================================= */

  function renderForm(params) {
    const editing = params.id ? Store.getById(params.id) : null;
    const title = editing?.title ?? String(params.title ?? "").trim();
    const previous = editing ? null : Store.findLatestByTitle(title);
    const referenceEntry = window.HeliaReference.find(title);
    const referenceSummary = window.HeliaReference.getSummary();
    const today = Store.todayIso();

    /*
     * Date du dernier test HP connue avant ce contrôle :
     * contrôle local précédent, sinon référentiel SharePoint.
     */
    const baselineHpDate = editing
      ? editing.baselineHpDate ?? editing.lastHpTestDate
      : Store.normalizeHpDate(previous?.lastHpTestDate || referenceEntry?.lastHpTestDate || "");

    const baselineHpState = Store.getHpTestState(baselineHpDate).state;

    /*
     * La zone « Test HP » n'apparaît que si le dernier test date
     * de plus de 5 ans, ou si sa date est inconnue.
     */
    const hpZoneVisible = editing
      ? editing.hpZoneShown !== false
      : ["overdue", "empty", "invalid", "future"].includes(baselineHpState);

    const values = {
      id: editing?.id ?? null,
      title,
      controlDate: editing?.controlDate ?? today,
      status: editing?.status ?? "",
      hpTest: editing?.hpTest ?? "",
      lastHpTestDate: editing?.lastHpTestDate ?? baselineHpDate,
      comments: editing?.comments ?? "",
    };

    const markDirty = () => {
      formIsDirty = true;
    };

    /* --- Hydrant (Titre) --- */

    const titleInput = h("input", {
      className: "input input-title",
      attrs: {
        id: "f-title",
        type: "text",
        value: values.title,
        autocomplete: "off",
        autocapitalize: "characters",
        spellcheck: "false",
        required: true,
        maxlength: 255,
      },
      on: { input: markDirty },
    });

    const titleError = fieldError("f-title-error");

    const identity = h("section", { className: "card identity" }, [
      h("div", { className: "card-head" }, [
        h("span", { className: "badge-icon" }, icon("hydrant")),
        h("div", { className: "grow" }, [
          h("label", {
            className: "eyebrow",
            attrs: { for: "f-title" },
            text: CONFIG.sharePoint.columns.title,
          }),
          titleInput,
          titleError,
        ]),
      ]),
      h("div", { className: "meta-row" }, [
        icon("calendar", "icon icon-sm"),
        h("span", { text: `${CONFIG.sharePoint.columns.controlDate} : ` }),
        h("strong", { text: Store.formatIsoDate(values.controlDate) }),
        values.controlDate === today ? h("span", { className: "chip", text: "Aujourd'hui" }) : null,
      ]),
      baselineHpDate && !hpZoneVisible
        ? h("div", { className: "meta-row" }, [
            icon("gauge", "icon icon-sm"),
            h("span", { text: `${CONFIG.sharePoint.columns.lastHpTestDate} : ` }),
            h("strong", { text: baselineHpDate }),
            h("span", {
              className: `chip ${baselineHpState === "soon" ? "chip-warn" : "chip-ok"}`,
              text: baselineHpState === "soon" ? "Échéance proche" : "À jour",
            }),
          ])
        : null,
      referenceEntry
        ? h("p", {
            className: "reference-line",
            text: `SharePoint : dernier contrôle ${referenceEntry.controlDate || "—"}${referenceEntry.status ? ` · statut ${referenceEntry.status}` : ""}${referenceEntry.hpTest ? ` · test HP ${referenceEntry.hpTest}` : ""}`,
          })
        : null,
    ]);

    const referenceNotice =
      !editing && referenceSummary.loaded && !referenceEntry
        ? h("div", { className: "alert alert-warn" }, [
            h("p", { text: "Cet hydrant ne figure pas dans le référentiel SharePoint chargé. Vérifiez le code scanné." }),
          ])
        : null;

    /* --- Contrôle déjà présent --- */

    let previousNotice = null;

    if (previous) {
      const sameDay = previous.controlDate === today;

      previousNotice = h("div", { className: `alert ${sameDay ? "alert-warn" : "alert-info"}` }, [
        h("p", {
          text: sameDay
            ? "Cet hydrant a déjà été contrôlé aujourd'hui."
            : `Dernier contrôle enregistré le ${Store.formatIsoDate(previous.controlDate)}${previous.status ? ` (statut ${previous.status})` : ""}.`,
        }),
        sameDay
          ? button({
              label: "Modifier ce contrôle",
              iconName: "edit",
              variant: "ghost",
              onClick: () => navigate(SCREENS.FORM, { id: previous.id }, { replace: true }),
            })
          : null,
      ]);
    }

    /* --- Statut --- */

    const statusGroup = choiceGroup({
      name: "status",
      legend: CONFIG.sharePoint.columns.status,
      choices: CONFIG.statuses,
      value: values.status,
      columns: 4,
      onChange: markDirty,
    });

    /* --- Test HP --- */

    const hpGroup = choiceGroup({
      name: "hpTest",
      legend: `${CONFIG.sharePoint.columns.hpTest} (haute pression)`,
      choices: CONFIG.hpTests,
      value: values.hpTest,
      columns: 3,
      onChange: markDirty,
    });

    /* --- Date du dernier test HP --- */

    const hpDateInput = h("input", {
      className: "input",
      attrs: {
        id: "f-hpdate",
        type: "text",
        inputmode: "numeric",
        autocomplete: "off",
        placeholder: "AAAA ou JJ/MM/AAAA",
        value: values.lastHpTestDate,
        maxlength: 20,
        "aria-describedby": "f-hpdate-help f-hpdate-error",
      },
    });

    const hpDateError = fieldError("f-hpdate-error");
    const hpIndicator = h("div", { className: "hp-indicator", attrs: { "aria-live": "polite" } });

    const refreshHpIndicator = () => {
      renderHpIndicator(hpIndicator, hpDateInput.value);
      clearError(hpDateInput, hpDateError);
    };

    hpDateInput.addEventListener("input", () => {
      markDirty();
      refreshHpIndicator();
    });

    hpDateInput.addEventListener("blur", () => {
      const parsed = Store.parseHpDate(hpDateInput.value);
      if (parsed) {
        hpDateInput.value = parsed.text;
        refreshHpIndicator();
      }
    });

    const todayChip = h("button", {
      className: "chip chip-btn",
      attrs: { type: "button" },
      text: "Aujourd'hui",
      on: {
        click: () => {
          hpDateInput.value = Store.formatIsoDate(today);
          markDirty();
          refreshHpIndicator();
        },
      },
    });

    const hpDateField = h("div", { className: "field" }, [
      h("div", { className: "label-row" }, [
        h("label", { className: "label", attrs: { for: "f-hpdate" }, text: CONFIG.sharePoint.columns.lastHpTestDate }),
        todayChip,
      ]),
      hpDateInput,
      h("p", {
        className: "help",
        attrs: { id: "f-hpdate-help" },
        text: baselineHpDate && !editing
          ? `Repris ${previous?.lastHpTestDate ? "du dernier contrôle" : "de SharePoint"}. Passe à aujourd'hui si le test HP est OK.`
          : "Année seule acceptée (ex. 2020).",
      }),
      hpDateError,
      hpIndicator,
    ]);

    renderHpIndicator(hpIndicator, values.lastHpTestDate);

    /*
     * Test HP « OK » : le dernier test devient celui d'aujourd'hui.
     * Si l'on change d'avis, la date d'origine est restaurée.
     */
    const todayText = Store.formatIsoDate(today);

    hpGroup.element.addEventListener("change", () => {
      const choice = hpGroup.getValue();

      if (choice === "OK" && hpDateInput.value.trim() === baselineHpDate) {
        hpDateInput.value = todayText;
        refreshHpIndicator();
      } else if (choice !== "OK" && hpDateInput.value.trim() === todayText && baselineHpDate !== todayText) {
        hpDateInput.value = baselineHpDate;
        refreshHpIndicator();
      }
    });

    const hpZone = hpZoneVisible
      ? h("section", { className: "card hp-zone" }, [
          h("div", { className: "hp-zone-head" }, [
            icon("warning", "icon"),
            h("div", {}, [
              h("h2", { className: "card-title", text: "Contrôle haute pression" }),
              h("p", {
                className: "help",
                text:
                  baselineHpState === "overdue"
                    ? `Le dernier test HP date de plus de ${CONFIG.hpTestMaxAgeYears} ans.`
                    : "Date du dernier test HP inconnue.",
              }),
            ]),
          ]),
          hpGroup.element,
          hpDateField,
        ])
      : null;

    /* --- Commentaires --- */

    const commentsInput = h("textarea", {
      className: "input textarea",
      attrs: { id: "f-comments", rows: 3, maxlength: 2000, placeholder: "Observations, anomalies…" },
      on: { input: markDirty },
    });
    commentsInput.value = values.comments;

    const commentsField = h("div", { className: "field" }, [
      h("label", { className: "label", attrs: { for: "f-comments" }, text: CONFIG.sharePoint.columns.comments }),
      commentsInput,
    ]);

    /* --- Actions --- */

    const form = h(
      "form",
      {
        className: "control-form",
        attrs: { novalidate: true },
        on: {
          submit: (event) => {
            event.preventDefault();
            submit();
          },
        },
      },
      [
        identity,
        referenceNotice,
        previousNotice,
        h("section", { className: "card" }, [statusGroup.element]),
        hpZone,
        h("section", { className: "card" }, [commentsField]),
        h("div", { className: "actions sticky-actions" }, [
          h("button", { className: "btn btn-primary btn-lg", attrs: { type: "submit" } }, [
            icon("check"),
            h("span", { text: editing ? "Enregistrer les modifications" : "Enregistrer le contrôle" }),
          ]),
        ]),
      ]
    );

    function submit() {
      let firstInvalid = null;

      const titleValue = titleInput.value.trim();
      if (!titleValue) {
        showError(titleInput, titleError, "Le code de l'hydrant est obligatoire.");
        firstInvalid ??= titleInput;
      } else {
        clearError(titleInput, titleError);
      }

      if (!statusGroup.validate("Choisissez un statut.")) firstInvalid ??= statusGroup.element;
      if (hpZoneVisible && !hpGroup.validate("Indiquez le résultat du test HP.")) firstInvalid ??= hpGroup.element;

      const hpState = hpZoneVisible ? Store.getHpTestState(hpDateInput.value) : { state: "ok" };
      if (hpState.state === "invalid") {
        showError(hpDateInput, hpDateError, "Format non reconnu. Exemples : 2020, 03/2021, 15/03/2021.");
        firstInvalid ??= hpDateInput;
      } else if (hpState.state === "future") {
        showError(hpDateInput, hpDateError, "La date du dernier test ne peut pas être dans le futur.");
        firstInvalid ??= hpDateInput;
      }

      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusTarget = firstInvalid.matches("input, textarea")
          ? firstInvalid
          : firstInvalid.querySelector("input");
        focusTarget?.focus({ preventScroll: true });
        return;
      }

      const saved = Store.upsert({
        id: values.id,
        title: titleValue,
        controlDate: values.controlDate,
        status: statusGroup.getValue(),
        hpTest: hpZoneVisible ? hpGroup.getValue() : "",
        lastHpTestDate: hpZoneVisible ? hpDateInput.value : baselineHpDate,
        baselineHpDate,
        hpZoneShown: hpZoneVisible,
        comments: commentsInput.value,
      });

      if (!saved) {
        showToast("Enregistrement impossible : le stockage du téléphone est plein ou bloqué.", "danger");
        return;
      }

      formIsDirty = false;

      if (editing) {
        showToast("Contrôle mis à jour.");
        goBack();
      } else {
        navigate(SCREENS.SAVED, { id: saved.id }, { replace: true });
      }
    }

    const back = () => {
      if (!formIsDirty) {
        goBack();
        return;
      }

      confirmDialog({
        title: "Abandonner la saisie ?",
        message: "Le contrôle en cours n'a pas été enregistré.",
        confirmLabel: "Abandonner",
        danger: true,
      }).then((confirmed) => {
        if (confirmed) {
          formIsDirty = false;
          goBack();
        }
      });
    };

    const beforeUnload = (event) => {
      if (formIsDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    cleanup = () => window.removeEventListener("beforeunload", beforeUnload);

    return screenShell("form", [
      topBar(editing ? "Modifier le contrôle" : "Contrôle de l'hydrant", {
        subtitle: editing ? "Liste des contrôles" : "Étape 2 sur 2",
        onBack: back,
      }),
      form,
    ]);
  }

  /**
   * Groupe de boutons radio présentés sous forme de tuiles.
   */
  function choiceGroup({ name, legend, choices, value, columns, onChange }) {
    const error = fieldError(`f-${name}-error`);

    const options = choices.map((choice) => {
      const id = `f-${name}-${choice.value.replace(/\W+/g, "-").toLowerCase()}`;

      const input = h("input", {
        className: "choice-input",
        attrs: { type: "radio", name, id, value: choice.value, checked: choice.value === value },
        on: {
          change: () => {
            fieldset.classList.remove("has-error");
            error.textContent = "";
            onChange?.();
          },
        },
      });

      return h("label", { className: `choice tone-${choice.tone}`, attrs: { for: id } }, [
        input,
        h("span", { className: "choice-box" }, [
          h("span", { className: "choice-dot", attrs: { "aria-hidden": "true" } }),
          h("strong", { className: "choice-label", text: choice.label }),
          choice.hint ? h("small", { className: "choice-hint", text: choice.hint }) : null,
        ]),
      ]);
    });

    const fieldset = h(
      "fieldset",
      { className: "choice-group", attrs: { "aria-describedby": `f-${name}-error` } },
      [
        h("legend", { className: "label", text: legend }),
        h("div", { className: `choices cols-${columns}` }, options),
        error,
      ]
    );

    return {
      element: fieldset,
      getValue: () => fieldset.querySelector("input:checked")?.value ?? "",
      validate(message) {
        if (fieldset.querySelector("input:checked")) return true;
        fieldset.classList.add("has-error");
        error.textContent = message;
        return false;
      },
    };
  }

  function fieldError(id) {
    return h("p", { className: "field-error", attrs: { id, role: "alert" } });
  }

  function showError(input, errorElement, message) {
    input.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
  }

  function clearError(input, errorElement) {
    input.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
    errorElement.textContent = "";
  }

  /* =========================================================
     INDICATEUR DU TEST HAUTE PRESSION
     ========================================================= */

  /**
   * Jauge circulaire : âge du dernier test HP rapporté
   * au délai maximal de 5 ans. Au-delà, l'alerte est
   * mise en évidence.
   */
  function renderHpIndicator(container, value) {
    const info = Store.getHpTestState(value);
    container.replaceChildren();
    container.className = `hp-indicator hp-${info.state}`;

    if (["empty", "invalid", "future"].includes(info.state)) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    const maxAge = CONFIG.hpTestMaxAgeYears;
    const ratio = Math.min(1, info.ageYears / maxAge);
    const circumference = 2 * Math.PI * 26;
    const ageText = formatAge(info.ageYears);

    const gauge = h("div", { className: "hp-gauge", attrs: { "aria-hidden": "true" } });
    gauge.innerHTML = `
      <svg viewBox="0 0 64 64">
        <circle class="hp-track" cx="32" cy="32" r="26"/>
        <circle class="hp-fill" cx="32" cy="32" r="26"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${(circumference * (1 - ratio)).toFixed(2)}"
          transform="rotate(-90 32 32)"/>
      </svg>`;

    gauge.append(
      info.state === "overdue"
        ? icon("warning", "hp-gauge-icon")
        : h("span", { className: "hp-gauge-value", text: `${Math.floor(info.ageYears)}a` })
    );

    const titles = {
      ok: "Test HP valide",
      soon: "Test HP à prévoir",
      overdue: `Test HP de plus de ${maxAge} ans`,
    };

    const dueText = info.dueDate.toLocaleDateString("fr-BE", {
      month: "long",
      year: "numeric",
      ...(info.precision === "day" ? { day: "numeric" } : {}),
    });

    const lastText = Store.parseHpDate(value).text;

    const details = {
      ok: `Dernier test : ${lastText} (${ageText}). Échéance : ${dueText}.`,
      soon: `Dernier test : ${lastText} (${ageText}). Échéance proche : ${dueText}.`,
      overdue: `Dernier test : ${lastText}, échéance dépassée depuis ${dueText}. Un nouveau test haute pression est requis.`,
    };

    container.append(
      gauge,
      h("div", { className: "hp-text" }, [
        h("strong", { text: titles[info.state] }),
        h("span", { text: details[info.state] }),
      ])
    );
  }

  function formatAge(years) {
    if (years < 1) {
      const months = Math.max(0, Math.floor(years * 12));
      return months <= 1 ? "moins d'un mois" : `il y a ${months} mois`;
    }

    const whole = Math.floor(years);
    return `il y a ${whole} an${whole > 1 ? "s" : ""}`;
  }

  /**
   * Petit badge utilisé dans la liste.
   */
  function hpBadge(value) {
    const info = Store.getHpTestState(value);

    if (info.state === "overdue") {
      return h("span", { className: "tag tag-danger tag-pulse" }, [
        icon("warning", "icon icon-xs"),
        h("span", { text: `HP > ${CONFIG.hpTestMaxAgeYears} ans` }),
      ]);
    }

    if (info.state === "soon") {
      return h("span", { className: "tag tag-warn" }, [
        icon("gauge", "icon icon-xs"),
        h("span", { text: "HP à prévoir" }),
      ]);
    }

    return null;
  }

  /* =========================================================
     ÉCRAN : CONFIRMATION
     ========================================================= */

  function renderSaved(params) {
    const control = Store.getById(params.id);

    if (!control) {
      return renderHome();
    }

    const hpInfo = Store.getHpTestState(control.lastHpTestDate);

    return screenShell("saved", [
      h("section", { className: "saved" }, [
        h("div", { className: "saved-check" }, icon("check")),
        h("h1", { className: "saved-title", text: "Contrôle enregistré" }),
        h("p", { className: "saved-code", text: control.title }),
        h("div", { className: "tags center" }, [
          statusTag(control.status),
          control.hpTest ? h("span", { className: "tag", text: `Test HP : ${hpLabel(control.hpTest)}` }) : null,
          hpBadge(control.lastHpTestDate),
        ]),
        hpInfo.state === "overdue"
          ? h("p", {
              className: "alert alert-danger",
              text: `Le dernier test haute pression date de plus de ${CONFIG.hpTestMaxAgeYears} ans.`,
            })
          : null,
      ]),
      h("div", { className: "actions" }, [
        button({
          label: "Scanner l'hydrant suivant",
          iconName: "qr",
          variant: "primary btn-lg",
          onClick: () => navigate(SCREENS.SCAN, {}, { replace: true }),
        }),
        button({
          label: `Voir la liste (${Store.getAll().length})`,
          iconName: "list",
          variant: "ghost",
          onClick: () => navigate(SCREENS.LIST, {}, { replace: true }),
        }),
        button({ label: "Accueil", iconName: "home", variant: "text", onClick: goHome }),
      ]),
    ]);
  }

  function statusTag(status) {
    if (!status) return null;
    const choice = CONFIG.statuses.find((item) => item.value === status);
    return h("span", { className: `tag tag-tone-${choice?.tone ?? "neutral"}`, text: status });
  }

  function hpLabel(value) {
    return CONFIG.hpTests.find((item) => item.value === value)?.label ?? value;
  }

  /* =========================================================
     ÉCRAN : LISTE
     ========================================================= */

  function renderList() {
    const controls = Store.getAll();
    const stats = computeStats(controls);

    const items = controls.map((control) => {
      const hpInfo = Store.getHpTestState(control.lastHpTestDate);

      return h("li", { className: `item ${hpInfo.state === "overdue" ? "item-alert" : ""}` }, [
        h(
          "button",
          {
            className: "item-main",
            attrs: { type: "button", "aria-label": `Modifier le contrôle ${control.title}` },
            on: { click: () => navigate(SCREENS.FORM, { id: control.id }) },
          },
          [
            h("span", { className: "item-title", text: control.title }),
            h("span", { className: "item-meta" }, [
              h("span", { text: Store.formatIsoDate(control.controlDate) }),
              control.lastHpTestDate
                ? h("span", { text: `Dernier test HP : ${control.lastHpTestDate}` })
                : null,
            ]),
            h("span", { className: "tags" }, [
              statusTag(control.status),
              control.hpTest ? h("span", { className: "tag", text: `HP ${hpLabel(control.hpTest)}` }) : null,
              hpBadge(control.lastHpTestDate),
            ]),
            control.comments ? h("span", { className: "item-comment", text: control.comments }) : null,
          ]
        ),
        h(
          "button",
          {
            className: "icon-btn icon-btn-danger",
            attrs: { type: "button", "aria-label": `Supprimer le contrôle ${control.title}` },
            on: {
              click: async () => {
                const confirmed = await confirmDialog({
                  title: "Supprimer ce contrôle ?",
                  message: control.title,
                  confirmLabel: "Supprimer",
                  danger: true,
                });

                if (confirmed) {
                  Store.remove(control.id);
                  showToast("Contrôle supprimé.");
                  render(current);
                }
              },
            },
          },
          icon("trash")
        ),
      ]);
    });

    const exportButton = button({
      label: "Exporter en CSV",
      iconName: "share",
      variant: "primary btn-lg",
      attrs: { disabled: controls.length === 0 },
      onClick: async () => {
        try {
          const result = await window.HeliaExport.share(Store.getAll());
          if (result === "shared") showToast("Fichier CSV partagé.");
          if (result === "downloaded") showToast("Fichier CSV téléchargé.");
        } catch (error) {
          console.error(error);
          showToast("L'export a échoué.", "danger");
        }
      },
    });

    const clearButton = button({
      label: "Vider la liste",
      iconName: "trash",
      variant: "text danger",
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: "Vider la liste ?",
          message: `Les ${controls.length} contrôles seront définitivement supprimés du téléphone. Vérifiez qu'ils ont bien été exportés.`,
          confirmLabel: "Tout supprimer",
          danger: true,
        });

        if (confirmed) {
          Store.clear();
          showToast("Liste vidée.");
          render(current);
        }
      },
    });

    return screenShell("list", [
      topBar("Contrôles enregistrés", { subtitle: `Liste ${CONFIG.sharePoint.listName}` }),
      h("section", { className: "card card-compact" }, [
        h("div", { className: "stats" }, [
          stat(String(stats.total), "Contrôles"),
          stat(String(stats.notOk), "Statut ≠ OK", stats.notOk ? "warn" : ""),
          stat(String(stats.hpOverdue), "Test HP > 5 ans", stats.hpOverdue ? "danger" : ""),
        ]),
      ]),
      controls.length
        ? h("ul", { className: "items" }, items)
        : h("section", { className: "card empty" }, [
            h("p", { className: "muted", text: "Aucun contrôle enregistré pour l'instant." }),
          ]),
      h("div", { className: "actions sticky-actions" }, [
        exportButton,
        button({
          label: "Scanner un hydrant",
          iconName: "plus",
          variant: "ghost",
          onClick: () => navigate(SCREENS.SCAN),
        }),
        controls.length ? clearButton : null,
      ]),
    ]);
  }

  /* =========================================================
     DIALOGUE ET NOTIFICATIONS
     ========================================================= */

  function confirmDialog({ title, message, confirmLabel = "Confirmer", danger = false }) {
    return new Promise((resolve) => {
      const previousFocus = document.activeElement;

      const close = (result) => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        previousFocus?.focus?.({ preventScroll: true });
        resolve(result);
      };

      const onKey = (event) => {
        if (event.key === "Escape") close(false);
      };

      const confirmButton = h("button", {
        className: `btn ${danger ? "btn-danger" : "btn-primary"}`,
        attrs: { type: "button" },
        text: confirmLabel,
        on: { click: () => close(true) },
      });

      const overlay = h(
        "div",
        {
          className: "overlay",
          on: { click: (event) => event.target === overlay && close(false) },
        },
        h(
          "div",
          {
            className: "dialog",
            attrs: { role: "alertdialog", "aria-modal": "true", "aria-labelledby": "dialog-title", "aria-describedby": "dialog-message" },
          },
          [
            h("h2", { className: "dialog-title", attrs: { id: "dialog-title" }, text: title }),
            h("p", { className: "dialog-message", attrs: { id: "dialog-message" }, text: message }),
            h("div", { className: "dialog-actions" }, [
              h("button", {
                className: "btn btn-ghost",
                attrs: { type: "button" },
                text: "Annuler",
                on: { click: () => close(false) },
              }),
              confirmButton,
            ]),
          ]
        )
      );

      document.body.append(overlay);
      document.addEventListener("keydown", onKey);
      confirmButton.focus();
    });
  }

  function showToast(message, tone = "ok") {
    let toast = document.getElementById("toast");

    if (!toast) {
      toast = h("div", { className: "toast", attrs: { id: "toast", role: "status", "aria-live": "polite" } });
      document.body.append(toast);
    }

    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  /* =========================================================
     DÉMARRAGE
     ========================================================= */

  function start() {
    root = document.getElementById("app");

    window.addEventListener("popstate", onPopState);

    // On démarre toujours sur l'accueil.
    window.history.replaceState({ screen: SCREENS.HOME, params: {} }, "");
    render({ screen: SCREENS.HOME, params: {} });

    // Libère la caméra si l'application passe en arrière-plan.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && current.screen === SCREENS.SCAN) {
        goBack();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  return Object.freeze({ navigate, SCREENS });
})();
