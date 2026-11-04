"use strict";

/**
 * Export des contrôles au format CSV.
 *
 * Les en-têtes reprennent exactement les noms des colonnes
 * de la liste SharePoint « HEL-Hydrants ». Le fichier utilise
 * le point-virgule et un BOM UTF-8 pour s'ouvrir correctement
 * dans Excel en français.
 */
window.HeliaExport = (() => {
  const SEPARATOR = ";";
  const LINE_BREAK = "\r\n";

  function createCsv(controls) {
    const columns = window.HELIA_CONFIG.sharePoint.columns;

    const header = [
      columns.title,
      columns.controlDate,
      columns.status,
      columns.hpTest,
      columns.lastHpTestDate,
      columns.comments,
    ];

    const rows = controls.map((control) => [
      control.title,
      window.HeliaStore.formatIsoDate(control.controlDate),
      control.status,
      control.hpTest,
      control.lastHpTestDate,
      control.comments,
    ]);

    return (
      "﻿" +
      [header, ...rows]
        .map((row) => row.map(escapeCell).join(SEPARATOR))
        .join(LINE_BREAK) +
      LINE_BREAK
    );
  }

  function escapeCell(value) {
    let text = String(value ?? "");

    // Empêche Excel d'interpréter une cellule comme une formule.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }

    if (/[";\r\n]/.test(text)) {
      text = `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  function createFilename() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    const stamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}h${pad(now.getMinutes())}`;

    return `${window.HELIA_CONFIG.sharePoint.listName}_controles_${stamp}.csv`;
  }

  function createFile(controls) {
    const content = createCsv(controls);
    const filename = createFilename();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });

    return { blob, filename };
  }

  /**
   * Ouvre le menu de partage du téléphone (mail, Teams, OneDrive…).
   * Bascule sur un téléchargement si le partage de fichiers
   * n'est pas disponible.
   *
   * @returns {Promise<"shared"|"downloaded"|"cancelled">}
   */
  async function share(controls) {
    const { blob, filename } = createFile(controls);

    let file = null;

    try {
      file = new File([blob], filename, { type: "text/csv" });
    } catch {
      file = null;
    }

    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${window.HELIA_CONFIG.sharePoint.listName} — contrôles`,
          text: `${controls.length} contrôle(s) d'hydrants — ATLAS H-ELIA`,
        });
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") {
          return "cancelled";
        }
        // Partage refusé : on passe au téléchargement.
      }
    }

    download(blob, filename);
    return "downloaded";
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return Object.freeze({
    createCsv,
    share,
    download: (controls) => {
      const { blob, filename } = createFile(controls);
      download(blob, filename);
    },
  });
})();
