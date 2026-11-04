"use strict";

/**
 * Stockage local des contrôles d'hydrants.
 *
 * Chaque contrôle correspond à une future ligne
 * de la liste SharePoint. Les données restent dans
 * le téléphone (localStorage) jusqu'à leur export.
 */
window.HeliaStore = (() => {
  const STORAGE_KEY = "atlas-h-elia.hydrants.controls.v1";
  const SCHEMA_VERSION = 1;

  const MAX_LENGTHS = Object.freeze({
    title: 255,
    lastHpTestDate: 20,
    comments: 2000,
  });

  let controls = [];
  let storageAvailable = false;
  let lastError = null;

  load();

  /* =========================================================
     PERSISTANCE
     ========================================================= */

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      storageAvailable = true;

      if (!raw) {
        controls = [];
        return;
      }

      const payload = JSON.parse(raw);
      const list = Array.isArray(payload?.controls) ? payload.controls : [];

      controls = list.map(normalizeControl).filter(Boolean);
    } catch (error) {
      lastError = error;
      storageAvailable = isStorageWritable();
      controls = [];
      console.warn("Lecture des contrôles impossible.", error);
    }
  }

  function save() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          savedAt: new Date().toISOString(),
          controls,
        })
      );
      lastError = null;
      return true;
    } catch (error) {
      lastError = error;
      console.error("Enregistrement des contrôles impossible.", error);
      return false;
    }
  }

  function isStorageWritable() {
    try {
      const key = `${STORAGE_KEY}.test`;
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  /* =========================================================
     NORMALISATION
     ========================================================= */

  function normalizeControl(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const title = cleanText(value.title, MAX_LENGTHS.title);

    if (!title) {
      return null;
    }

    const now = new Date().toISOString();

    return {
      id: typeof value.id === "string" && value.id ? value.id : createId(),
      title,
      controlDate: isIsoDate(value.controlDate) ? value.controlDate : todayIso(),
      status: cleanChoice(value.status, window.HELIA_CONFIG.statuses),
      hpTest: cleanChoice(value.hpTest, window.HELIA_CONFIG.hpTests),
      lastHpTestDate: cleanText(value.lastHpTestDate, MAX_LENGTHS.lastHpTestDate),
      comments: cleanMultiline(value.comments, MAX_LENGTHS.comments),
      baselineHpDate: cleanText(value.baselineHpDate, MAX_LENGTHS.lastHpTestDate),
      hpZoneShown: value.hpZoneShown !== false,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
    };
  }

  function cleanText(value, maxLength) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function cleanMultiline(value, maxLength) {
    return String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .trim()
      .slice(0, maxLength);
  }

  function cleanChoice(value, choices) {
    const text = String(value ?? "").trim();
    return choices.some((choice) => choice.value === text) ? text : "";
  }

  /* =========================================================
     OPÉRATIONS
     ========================================================= */

  /**
   * Ajoute ou met à jour un contrôle.
   *
   * @param {Object} data Données du formulaire.
   * @returns {Object|null} Le contrôle enregistré.
   */
  function upsert(data) {
    const existingIndex = data.id
      ? controls.findIndex((control) => control.id === data.id)
      : -1;

    const previous = existingIndex >= 0 ? controls[existingIndex] : null;
    const now = new Date().toISOString();

    const control = normalizeControl({
      ...previous,
      ...data,
      lastHpTestDate: formatHpDateInput(data.lastHpTestDate),
      baselineHpDate: formatHpDateInput(data.baselineHpDate ?? previous?.baselineHpDate),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });

    if (!control) {
      return null;
    }

    if (existingIndex >= 0) {
      controls[existingIndex] = control;
    } else {
      controls.unshift(control);
    }

    return save() ? { ...control } : null;
  }

  function remove(id) {
    const before = controls.length;
    controls = controls.filter((control) => control.id !== id);

    if (controls.length !== before) {
      save();
      return true;
    }

    return false;
  }

  function clear() {
    controls = [];
    return save();
  }

  function getAll() {
    return controls.map((control) => ({ ...control }));
  }

  function getById(id) {
    const control = controls.find((item) => item.id === id);
    return control ? { ...control } : null;
  }

  /**
   * Dernier contrôle enregistré pour un hydrant donné.
   * Sert à pré-remplir la date du dernier test HP.
   */
  function findLatestByTitle(title) {
    const key = normalizeKey(title);

    const matches = controls
      .filter((control) => normalizeKey(control.title) === key)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return matches[0] ? { ...matches[0] } : null;
  }

  function normalizeKey(value) {
    return String(value ?? "").trim().toLocaleUpperCase("fr-BE");
  }

  /* =========================================================
     DATES
     ========================================================= */

  function todayIso() {
    const now = new Date();
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
    ].join("-");
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  /**
   * Convertit une date ISO (AAAA-MM-JJ) en JJ/MM/AAAA.
   */
  function formatIsoDate(value) {
    if (!isIsoDate(value)) {
      return "";
    }

    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  /**
   * Analyse la date du dernier test HP.
   *
   * Formats acceptés : AAAA, MM/AAAA, JJ/MM/AAAA, JJ-MM-AA
   * (séparateurs / . ou -) et AAAA-MM-JJ.
   *
   * Lorsque seule l'année (ou le mois) est connue,
   * on retient la fin de la période : l'alerte n'est
   * donc levée que lorsque le dépassement est certain.
   *
   * @returns {{ date: Date, text: string, precision: string }|null}
   */
  function parseHpDate(value) {
    const text = String(value ?? "").trim();

    if (!text) {
      return null;
    }

    let match;
    let year;
    let month = null;
    let day = null;

    if ((match = text.match(/^(\d{4})$/))) {
      year = Number(match[1]);
    } else if ((match = text.match(/^(\d{1,2})[/.-](\d{4})$/))) {
      month = Number(match[1]);
      year = Number(match[2]);
    } else if ((match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/))) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = expandYear(match[3]);
    } else if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      return null;
    }

    if (year < 1950 || year > 2100) {
      return null;
    }

    if (month !== null && (month < 1 || month > 12)) {
      return null;
    }

    let date;
    let precision;
    let normalized;

    if (day !== null) {
      date = new Date(year, month - 1, day);

      if (date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
      }

      precision = "day";
      normalized = `${pad(day)}/${pad(month)}/${year}`;
    } else if (month !== null) {
      date = new Date(year, month, 0);
      precision = "month";
      normalized = `${pad(month)}/${year}`;
    } else {
      date = new Date(year, 11, 31);
      precision = "year";
      normalized = String(year);
    }

    return { date, text: normalized, precision };
  }

  /**
   * Année sur deux chiffres (export SharePoint « 04-11-20 ») :
   * 20 → 2020, sauf si cela tombe dans le futur (→ 19xx).
   */
  function expandYear(text) {
    if (text.length === 4) {
      return Number(text);
    }

    const value = Number(text);
    const currentShort = new Date().getFullYear() % 100;
    return value <= currentShort + 1 ? 2000 + value : 1900 + value;
  }

  /**
   * Retourne la saisie normalisée si elle est valide,
   * sinon la saisie brute (elle sera signalée à l'écran).
   */
  function formatHpDateInput(value) {
    const parsed = parseHpDate(value);
    return parsed ? parsed.text : String(value ?? "").trim();
  }

  /**
   * État du test haute pression au regard du délai de 5 ans.
   *
   * @returns {{
   *   state: "empty"|"invalid"|"future"|"ok"|"soon"|"overdue",
   *   ageYears?: number,
   *   dueDate?: Date
   * }}
   */
  function getHpTestState(value, referenceDate = new Date()) {
    const text = String(value ?? "").trim();

    if (!text) {
      return { state: "empty" };
    }

    const parsed = parseHpDate(text);

    if (!parsed) {
      return { state: "invalid" };
    }

    const today = startOfDay(referenceDate);

    if (parsed.date > endOfYear(today) || (parsed.precision === "day" && parsed.date > today)) {
      return { state: "future" };
    }

    const maxAge = window.HELIA_CONFIG.hpTestMaxAgeYears;
    const warningMonths = window.HELIA_CONFIG.hpTestWarningMonths;

    const dueDate = new Date(parsed.date);
    dueDate.setFullYear(dueDate.getFullYear() + maxAge);

    const warningDate = new Date(dueDate);
    warningDate.setMonth(warningDate.getMonth() - warningMonths);

    const ageYears = Math.max(
      0,
      (today - parsed.date) / (365.25 * 24 * 3600 * 1000)
    );

    let state = "ok";

    if (today > dueDate) {
      state = "overdue";
    } else if (today >= warningDate) {
      state = "soon";
    }

    return { state, ageYears, dueDate, precision: parsed.precision };
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function endOfYear(date) {
    return new Date(date.getFullYear(), 11, 31);
  }

  /* =========================================================
     UTILITAIRES
     ========================================================= */

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function createId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `ctl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getStatus() {
    return { storageAvailable, lastError, count: controls.length };
  }

  return Object.freeze({
    upsert,
    remove,
    clear,
    getAll,
    getById,
    findLatestByTitle,
    normalizeKey,
    normalizeHpDate: formatHpDateInput,
    todayIso,
    formatIsoDate,
    parseHpDate,
    getHpTestState,
    getStatus,
  });
})();
