"use strict";

/**
 * Référentiel des hydrants importé depuis SharePoint.
 *
 * L'utilisateur charge le fichier CSV exporté de la liste
 * « HEL-Hydrants ». Ce référentiel sert uniquement à consulter
 * l'historique d'un hydrant lors du scan (notamment la date du
 * dernier test haute pression). Il n'apparaît jamais dans la
 * liste des contrôles et n'est pas réexporté.
 */
window.HeliaReference = (() => {
  const STORAGE_KEY = "atlas-h-elia.hydrants.reference.v1";

  let reference = { importedAt: null, fileName: "", hydrants: {} };

  load();

  /* =========================================================
     PERSISTANCE
     ========================================================= */

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (data && typeof data.hydrants === "object") {
        reference = {
          importedAt: data.importedAt ?? null,
          fileName: data.fileName ?? "",
          hydrants: data.hydrants,
        };
      }
    } catch (error) {
      console.warn("Lecture du référentiel impossible.", error);
    }
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reference));
  }

  /* =========================================================
     LECTURE DU CSV
     ========================================================= */

  /**
   * Analyse un CSV (virgule ou point-virgule, champs entre
   * guillemets, retours à la ligne dans les champs).
   *
   * @returns {string[][]}
   */
  function parseCsv(text) {
    const content = text.replace(/^﻿/, "");
    const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
    const delimiter =
      (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ";" : ",";

    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (inQuotes) {
        if (char === '"') {
          if (content[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && content[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * Importe le contenu d'un export SharePoint.
   * Remplace le référentiel précédent.
   *
   * @returns {{ count: number, overdue: number }}
   */
  function importCsv(text, fileName = "") {
    const rows = parseCsv(text);

    if (rows.length < 1) {
      throw new Error("Le fichier est vide.");
    }

    const columns = window.HELIA_CONFIG.sharePoint.columns;
    const header = rows[0].map(normalizeHeader);
    const indexOf = (label) => header.indexOf(normalizeHeader(label));

    const index = {
      title: indexOf(columns.title),
      controlDate: indexOf(columns.controlDate),
      status: indexOf(columns.status),
      hpTest: indexOf(columns.hpTest),
      lastHpTestDate: indexOf(columns.lastHpTestDate),
      comments: indexOf(columns.comments),
    };

    if (index.title < 0) {
      throw new Error(
        `Colonne « ${columns.title} » introuvable. Utilisez l'export CSV de la liste ${window.HELIA_CONFIG.sharePoint.listName}.`
      );
    }

    if (index.lastHpTestDate < 0) {
      throw new Error(`Colonne « ${columns.lastHpTestDate} » introuvable dans le fichier.`);
    }

    const cell = (cells, key) => (index[key] >= 0 ? String(cells[index[key]] ?? "").trim() : "");
    const hydrants = {};

    rows.slice(1).forEach((cells) => {
      const title = cell(cells, "title").replace(/\s+/g, " ");
      if (!title) return;

      const entry = {
        title,
        controlDate: cell(cells, "controlDate"),
        status: cell(cells, "status"),
        hpTest: cell(cells, "hpTest"),
        lastHpTestDate: cell(cells, "lastHpTestDate"),
        comments: cell(cells, "comments"),
      };

      const key = window.HeliaStore.normalizeKey(title);
      hydrants[key] = hydrants[key] ? mergeEntries(hydrants[key], entry) : entry;
    });

    const count = Object.keys(hydrants).length;

    if (!count) {
      throw new Error("Aucun hydrant trouvé dans le fichier.");
    }

    const previous = reference;
    reference = { importedAt: new Date().toISOString(), fileName, hydrants };

    try {
      save();
    } catch (error) {
      reference = previous;
      throw new Error("Le stockage du téléphone est plein : import impossible.");
    }

    return { count, overdue: countOverdue() };
  }

  /**
   * Si un hydrant apparaît plusieurs fois, on garde la ligne
   * la plus récente et la date de test HP la plus récente.
   */
  function mergeEntries(a, b) {
    const time = (value) => window.HeliaStore.parseHpDate(value)?.date.getTime() ?? -Infinity;
    const newer = time(b.controlDate) >= time(a.controlDate) ? b : a;
    const hpSource = time(b.lastHpTestDate) >= time(a.lastHpTestDate) ? b : a;

    return { ...newer, lastHpTestDate: hpSource.lastHpTestDate || newer.lastHpTestDate };
  }

  /* =========================================================
     CONSULTATION
     ========================================================= */

  function find(title) {
    const entry = reference.hydrants[window.HeliaStore.normalizeKey(title)];
    return entry ? { ...entry } : null;
  }

  function countOverdue() {
    return Object.values(reference.hydrants).filter(
      (entry) => window.HeliaStore.getHpTestState(entry.lastHpTestDate).state === "overdue"
    ).length;
  }

  function getSummary() {
    return {
      loaded: Boolean(reference.importedAt),
      importedAt: reference.importedAt,
      fileName: reference.fileName,
      count: Object.keys(reference.hydrants).length,
      overdue: countOverdue(),
    };
  }

  function clear() {
    reference = { importedAt: null, fileName: "", hydrants: {} };
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return Object.freeze({ importCsv, find, getSummary, clear, parseCsv });
})();
